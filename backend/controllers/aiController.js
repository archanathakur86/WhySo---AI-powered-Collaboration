import asyncHandler from "express-async-handler";
import Note from "../models/Note.js";
import FileItem from "../models/FileItem.js";
import Task from "../models/Task.js";
import User from "../models/User.js";
import {
  generateReadme,
  generateWeeklyReport,
  computeHealthInsight,
  semanticSearchAnswer,
  extractActionItems,
} from "../services/groqService.js";

// @route POST /api/projects/:projectId/ai/readme
export const generateProjectReadme = asyncHandler(async (req, res) => {
  const project = req.project;
  const files = await FileItem.find({ project: project._id }).select("originalName fileType").limit(50);
  const notes = await Note.find({ project: project._id }).select("title content").limit(20);

  const fileSummaries = files.map((f) => `- ${f.originalName} (${f.fileType})`);
  const noteSummaries = notes.map((n) => `- ${n.title}: ${n.content.slice(0, 120)}`);

  const readme = await generateReadme(project.name, project.description, fileSummaries, noteSummaries);
  project.readme = readme;
  await project.save();

  res.json({ success: true, readme });
});

// @route GET /api/projects/:projectId/ai/weekly-report
export const weeklyReport = asyncHandler(async (req, res) => {
  const project = req.project;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentLog = project.activityLog.filter((a) => new Date(a.createdAt) >= oneWeekAgo);

  if (recentLog.length === 0) {
    return res.json({ success: true, report: "No activity recorded in the project this week." });
  }

  const userIds = [...new Set(recentLog.map((a) => a.user?.toString()).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } }).select("name");
  const nameMap = Object.fromEntries(users.map((u) => [u._id.toString(), u.name]));

  const activityText = recentLog
    .map((a) => `${nameMap[a.user?.toString()] || "Someone"} - ${a.action}: ${a.detail} (${new Date(a.createdAt).toLocaleDateString()})`)
    .join("\n");

  const report = await generateWeeklyReport(project.name, activityText);
  res.json({ success: true, report });
});

// @route GET /api/projects/:projectId/ai/health
export const projectHealth = asyncHandler(async (req, res) => {
  const project = req.project;
  const [noteCount, fileCount] = await Promise.all([
    Note.countDocuments({ project: project._id }),
    FileItem.countDocuments({ project: project._id }),
  ]);

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentActivity = project.activityLog.filter((a) => new Date(a.createdAt) >= oneWeekAgo).length;
  const lastActivityDate = project.activityLog.length
    ? project.activityLog[project.activityLog.length - 1].createdAt
    : project.createdAt;
  const daysSinceLastActivity = Math.floor((Date.now() - new Date(lastActivityDate)) / (1000 * 60 * 60 * 24));

  const stats = { noteCount, fileCount, recentActivityCount: recentActivity, daysSinceLastActivity };
  const insight = await computeHealthInsight(stats);

  res.json({ success: true, stats, insight });
});

// @route GET /api/projects/:projectId/ai/search?q=...
export const aiSearch = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    res.status(400);
    throw new Error("Search query must be at least 2 characters");
  }

  const [notes, files] = await Promise.all([
    Note.find({ project: req.project._id }).select("title content").limit(40),
    FileItem.find({ project: req.project._id, textContent: { $ne: "" } }).select("originalName textContent").limit(20),
  ]);

  const candidates = [
    ...notes.map((n) => ({ id: n._id.toString(), type: "note", title: n.title, snippet: n.content.slice(0, 200) })),
    ...files.map((f) => ({ id: f._id.toString(), type: "file", title: f.originalName, snippet: f.textContent.slice(0, 200) })),
  ];

  if (candidates.length === 0) {
    return res.json({ success: true, results: [] });
  }

  const aiResults = await semanticSearchAnswer(q, candidates);
  // hydrate with full candidate data, preserving AI-ranked order
  const results = aiResults
    .map((r) => {
      const full = candidates.find((c) => c.id === r.id);
      return full ? { ...full, reason: r.reason } : null;
    })
    .filter(Boolean);

  res.json({ success: true, results });
});

// @route POST /api/notes/:noteId/extract-tasks
export const extractTasksFromNote = asyncHandler(async (req, res) => {
  const note = await Note.findById(req.params.noteId);
  if (!note) {
    res.status(404);
    throw new Error("Note not found");
  }

  const items = await extractActionItems(note.content);
  if (items.length === 0) {
    return res.json({ success: true, tasks: [], message: "No clear action items found in this note" });
  }

  const created = await Task.insertMany(
    items.map((item) => ({
      project: note.project,
      sourceNote: note._id,
      title: item.title,
      assigneeGuess: item.assigneeGuess || "",
      priority: ["low", "medium", "high"].includes(item.priority) ? item.priority : "medium",
      createdBy: "ai",
    }))
  );

  res.status(201).json({ success: true, tasks: created });
});

// @route GET /api/projects/:projectId/tasks
export const getTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ project: req.project._id }).sort({ createdAt: -1 });
  res.json({ success: true, tasks });
});

// @route PATCH /api/tasks/:taskId
export const updateTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  const { status, title, priority } = req.body;
  if (status) task.status = status;
  if (title) task.title = title;
  if (priority) task.priority = priority;
  await task.save();
  res.json({ success: true, task });
});

// @route DELETE /api/tasks/:taskId
export const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  await task.deleteOne();
  res.json({ success: true, message: "Task deleted" });
});
