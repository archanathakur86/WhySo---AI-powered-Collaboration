import asyncHandler from "express-async-handler";
import FileItem from "../models/FileItem.js";
import { uploadBufferToCloudinary, deleteFromCloudinary, isTextFile, getExtension } from "../services/uploadService.js";
import { explainCode, reviewCodeDiff } from "../services/groqService.js";
import { logActivity } from "./projectController.js";

// @route POST /api/projects/:projectId/files
export const uploadFile = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("No file provided");
  }

  const { originalname, buffer, mimetype } = req.file;
  const ext = getExtension(originalname);
  const textContent = isTextFile(originalname) ? buffer.toString("utf-8").slice(0, 20000) : "";

  // Check if a previous version of a file with same name exists in this project
  const previousVersion = await FileItem.findOne({ project: req.project._id, originalName: originalname }).sort({
    version: -1,
  });

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
    version: previousVersion ? previousVersion.version + 1 : 1,
    previousVersionId: previousVersion?._id || null,
  });

  logActivity(req.project, req.user._id, "file_uploaded", originalname);
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

// @route DELETE /api/files/:fileId
export const deleteFile = asyncHandler(async (req, res) => {
  const file = await FileItem.findById(req.params.fileId);
  if (!file) {
    res.status(404);
    throw new Error("File not found");
  }
  await deleteFromCloudinary(file.publicId);
  await file.deleteOne();
  res.json({ success: true, message: "File deleted" });
});

// @route POST /api/files/:fileId/explain
export const explainFile = asyncHandler(async (req, res) => {
  const file = await FileItem.findById(req.params.fileId);
  if (!file) {
    res.status(404);
    throw new Error("File not found");
  }
  if (!file.textContent) {
    res.status(400);
    throw new Error("This file type is not supported for AI explanation (binary/unreadable content)");
  }
  const explanation = await explainCode(file.textContent, file.originalName);
  res.json({ success: true, explanation });
});

// @route POST /api/files/:fileId/review  (AI code review against previous version)
export const reviewFile = asyncHandler(async (req, res) => {
  const file = await FileItem.findById(req.params.fileId);
  if (!file) {
    res.status(404);
    throw new Error("File not found");
  }
  if (!file.textContent) {
    res.status(400);
    throw new Error("This file type is not supported for AI review");
  }

  let oldContent = "";
  if (file.previousVersionId) {
    const prev = await FileItem.findById(file.previousVersionId);
    oldContent = prev?.textContent || "";
  }

  const review = await reviewCodeDiff(oldContent, file.textContent, file.originalName);
  res.json({ success: true, review, hasComparison: !!file.previousVersionId });
});
