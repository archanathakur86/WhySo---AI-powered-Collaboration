import asyncHandler from "express-async-handler";
import Note from "../models/Note.js";
import { generateTags, checkDuplicateNote, explainText, suggestImprovements } from "../services/groqService.js";
import { logActivity } from "./projectController.js";

// @route POST /api/projects/:projectId/notes
export const createNote = asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    res.status(400);
    throw new Error("Note title and content are required");
  }

  // Duplicate detection: compare against existing note summaries (best-effort, non-blocking)
  let duplicateWarning = null;
  try {
    const existing = await Note.find({ project: req.project._id }).select("title content").limit(30);
    const summaries = existing.map((n) => ({ id: n._id.toString(), summary: `${n.title}: ${n.content.slice(0, 150)}` }));
    const dupCheck = await checkDuplicateNote(`${title}: ${content}`, summaries);
    if (dupCheck.isDuplicate) duplicateWarning = dupCheck;
  } catch (err) {
    console.error("Duplicate check skipped:", err.message);
  }

  // AI auto-tagging (best-effort, non-blocking failure)
  let tags = [];
  try {
    tags = await generateTags(`${title}\n${content}`);
  } catch (err) {
    console.error("Tag generation skipped:", err.message);
  }

  const note = await Note.create({
    project: req.project._id,
    author: req.user._id,
    title,
    content,
    tags,
  });

  logActivity(req.project, req.user._id, "note_created", title);
  await req.project.save();

  res.status(201).json({ success: true, note, duplicateWarning });
});

// @route GET /api/projects/:projectId/notes
export const getNotes = asyncHandler(async (req, res) => {
  const notes = await Note.find({ project: req.project._id }).populate("author", "name avatar").sort({ updatedAt: -1 });
  res.json({ success: true, notes });
});

// @route PATCH /api/notes/:noteId
export const updateNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.noteId);
  if (!note) {
    res.status(404);
    throw new Error("Note not found");
  }
  const { title, content } = req.body;
  if (title) note.title = title;
  if (content !== undefined) note.content = content;

  if (content !== undefined) {
    try {
      note.tags = await generateTags(`${note.title}\n${content}`);
    } catch (err) {
      console.error("Tag regeneration skipped:", err.message);
    }
  }

  await note.save();
  res.json({ success: true, note });
});

// @route DELETE /api/notes/:noteId
export const deleteNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.noteId);
  if (!note) {
    res.status(404);
    throw new Error("Note not found");
  }
  await note.deleteOne();
  res.json({ success: true, message: "Note deleted" });
});

// @route POST /api/notes/:noteId/explain
export const explainNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.noteId);
  if (!note) {
    res.status(404);
    throw new Error("Note not found");
  }
  const explanation = await explainText(note.content, "note");
  res.json({ success: true, explanation });
});

// @route POST /api/notes/:noteId/improve
export const improveNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.noteId);
  if (!note) {
    res.status(404);
    throw new Error("Note not found");
  }
  const suggestions = await suggestImprovements(note.content);
  res.json({ success: true, suggestions });
});
