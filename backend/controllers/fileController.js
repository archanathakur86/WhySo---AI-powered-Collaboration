import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import FileItem from "../models/FileItem.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
  fetchStoredFile,
  contentTypeFor,
  isTextFile,
  getExtension,
} from "../services/uploadService.js";
import { explainCode, reviewCodeDiff } from "../services/groqService.js";
import { logActivity } from "./projectController.js";
import { loadProjectForUser } from "../utils/projectAccess.js";
import { buildLineDiff, isSameContent } from "../utils/lineDiff.js";

const MAX_TEXT_CHARS = 20000; // stored per file for diffing / AI
const MAX_REVIEW_CODE_CHARS = 12000; // whole-file review of a first version

// File routes only carry a :fileId, so the project (and the caller's role in
// it) has to be looked up here instead of by the loadProject middleware.
const loadFileForUser = async (req, res, allowedRoles = null) => {
  const { fileId } = req.params;
  if (!mongoose.isValidObjectId(fileId)) {
    res.status(404);
    throw new Error("File not found");
  }
  const file = await FileItem.findById(fileId);
  if (!file) {
    res.status(404);
    throw new Error("File not found");
  }
  const { project } = await loadProjectForUser(res, file.project, req.user, allowedRoles);
  return { file, project };
};

// @route POST /api/projects/:projectId/files
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file provided");
  }

  const { originalname, buffer, mimetype } = req.file;
  const ext = getExtension(originalname);
  const textContent = isTextFile(originalname) ? buffer.toString("utf-8").slice(0, MAX_TEXT_CHARS) : "";

  // Uploading a file with the same name as an existing one = a new version of it
  const previousVersion = await FileItem.findOne({ project: req.project._id, originalName: originalname }).sort({
    version: -1,
  });
  const version = previousVersion ? previousVersion.version + 1 : 1;

  let uploadResult;
  try {
    uploadResult = await uploadBufferToCloudinary(buffer, `whyso/${req.project._id}`);
  } catch (err) {
    res.status(502);
    throw new Error("File storage upload failed. Please try again.");
  }

  const file = await FileItem.create({
    project: req.project._id,
    uploader: req.user._id,
    originalName: originalname,
    url: uploadResult.secure_url,
    publicId: uploadResult.public_id,
    fileType: ext,
    textContent,
    version,
    previousVersionId: previousVersion?._id || null,
  });

  logActivity(req.project, req.user._id, "file_uploaded", `${originalname} (v${version})`);
  await req.project.save();

  res.status(201).json({ success: true, file, mimetype });
});

// @route GET /api/projects/:projectId/files
export const getFiles = asyncHandler(async (req, res) => {
  const files = await FileItem.find({ project: req.project._id })
    .populate("uploader", "name avatar")
    .sort({ createdAt: -1 });
  res.json({ success: true, files });
});

// @route GET /api/files/:fileId/download
// Streams the stored file through our API instead of sending the browser to
// Cloudinary's public URL. This works even when Cloudinary blocks public
// delivery of PDFs (401 "deny or ACL failure") and keeps access limited to
// project members.
export const downloadFile = asyncHandler(async (req, res) => {
  const { file } = await loadFileForUser(req, res);

  let buffer;
  try {
    buffer = await fetchStoredFile(file);
  } catch (err) {
    console.error(`File fetch failed for ${file._id}: ${err.message}`);
    res.status(502);
    throw new Error(
      "Couldn't read this file from cloud storage. If it's a PDF or ZIP, enable 'PDF and ZIP files delivery' in Cloudinary → Settings → Security."
    );
  }

  res.set({
    "Content-Type": contentTypeFor(file.fileType),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    "Content-Length": buffer.length,
    "Cache-Control": "private, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  res.send(buffer);
});

// @route DELETE /api/files/:fileId
export const deleteFile = asyncHandler(async (req, res) => {
  const { file } = await loadFileForUser(req, res, ["owner", "editor"]);
  await deleteFromCloudinary(file.publicId, file.url);
  await file.deleteOne();
  res.json({ success: true, message: "File deleted" });
});

// @route POST /api/files/:fileId/explain
export const explainFile = asyncHandler(async (req, res) => {
  const { file } = await loadFileForUser(req, res);
  if (!file.textContent) {
    res.status(400);
    throw new Error("This file type is not supported for AI explanation (binary/unreadable content)");
  }
  const explanation = await explainCode(file.textContent, file.originalName);
  res.json({ success: true, explanation });
});

// @route POST /api/files/:fileId/review   body: { regenerate?: boolean }
// AI code review of this version against the previous one (Summary / Risks / Suggestions).
// The result is saved on the file, so it's only generated once unless `regenerate` is set.
export const reviewFile = asyncHandler(async (req, res) => {
  const { file } = await loadFileForUser(req, res);
  if (!file.textContent) {
    res.status(400);
    throw new Error("This file type is not supported for AI review");
  }

  if (file.review?.generatedAt && req.body?.regenerate !== true) {
    return res.json({ success: true, review: file.review, cached: true });
  }

  // A deleted or missing earlier version simply means we review the file on its own.
  const previous = file.previousVersionId
    ? await FileItem.findOne({ _id: file.previousVersionId, project: file.project })
    : null;

  const sourceTruncated = file.textContent.length >= MAX_TEXT_CHARS;
  let review;

  if (previous && isSameContent(previous.textContent, file.textContent)) {
    review = {
      summary: `No code changes compared to v${previous.version}.`,
      riskLevel: "low",
      risks: [],
      suggestions: [],
      comparedWithVersion: previous.version,
      addedLines: 0,
      removedLines: 0,
      truncated: false,
    };
  } else {
    let aiInput;
    let stats = { added: 0, removed: 0, truncated: sourceTruncated };
    if (previous) {
      const diff = buildLineDiff(previous.textContent, file.textContent);
      aiInput = { filename: file.originalName, diffText: diff.diffText };
      stats = { added: diff.added, removed: diff.removed, truncated: sourceTruncated || diff.truncated };
    } else {
      aiInput = {
        filename: file.originalName,
        code: file.textContent.slice(0, MAX_REVIEW_CODE_CHARS),
        isFirstVersion: true,
      };
      stats.truncated = sourceTruncated || file.textContent.length > MAX_REVIEW_CODE_CHARS;
    }

    let ai;
    try {
      ai = await reviewCodeDiff(aiInput);
    } catch (err) {
      res.status(502);
      throw new Error(err.message || "AI review failed. Please try again.");
    }

    review = {
      ...ai,
      comparedWithVersion: previous ? previous.version : null,
      addedLines: stats.added,
      removedLines: stats.removed,
      truncated: stats.truncated,
    };
  }

  file.review = { ...review, generatedAt: new Date() };
  await file.save();

  res.json({ success: true, review: file.review, cached: false });
});