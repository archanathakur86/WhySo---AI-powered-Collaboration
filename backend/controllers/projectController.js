import asyncHandler from "express-async-handler";
import Project from "../models/Project.js";
import User from "../models/User.js";
import Note from "../models/Note.js";
import FileItem from "../models/FileItem.js";

const logActivity = (project, userId, action, detail = "") => {
  project.activityLog.push({ user: userId, action, detail, createdAt: new Date() });
  // cap log length to last 200 entries
  if (project.activityLog.length > 200) {
    project.activityLog = project.activityLog.slice(-200);
  }
};

// @route POST /api/projects
export const createProject = asyncHandler(async (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Project name is required");
  }

  const project = await Project.create({
    name,
    description: description || "",
    owner: req.user._id,
    members: [],
  });

  res.status(201).json({ success: true, project });
});

// @route GET /api/projects  (all projects current user is part of)
export const getMyProjects = asyncHandler(async (req, res) => {
  const projects = await Project.find({
    $or: [{ owner: req.user._id }, { "members.user": req.user._id }],
  })
    .sort({ updatedAt: -1 })
    .populate("owner", "name email avatar");

  res.json({ success: true, projects });
});

// @route GET /api/projects/:projectId
export const getProject = asyncHandler(async (req, res) => {
  const project = await req.project.populate([
    { path: "owner", select: "name email avatar" },
    { path: "members.user", select: "name email avatar" },
  ]);
  res.json({ success: true, project });
});

// @route POST /api/projects/:projectId/members
export const addMember = asyncHandler(async (req, res) => {
  const { email, role } = req.body;
  const project = req.project;

  if (project.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Only the project owner can add members");
  }

  const userToAdd = await User.findOne({ email: email?.toLowerCase() });
  if (!userToAdd) {
    res.status(404);
    throw new Error("No user found with that email");
  }

  const alreadyMember = project.members.some((m) => m.user.toString() === userToAdd._id.toString());
  if (alreadyMember) {
    res.status(400);
    throw new Error("User is already a member of this project");
  }

  project.members.push({ user: userToAdd._id, role: role || "editor" });
  logActivity(project, req.user._id, "member_added", `${userToAdd.name} added as ${role || "editor"}`);
  await project.save();

  res.json({ success: true, project });
});

// @route DELETE /api/projects/:projectId/members/:userId
export const removeMember = asyncHandler(async (req, res) => {
  const project = req.project;
  if (project.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Only the project owner can remove members");
  }
  project.members = project.members.filter((m) => m.user.toString() !== req.params.userId);
  logActivity(project, req.user._id, "member_removed");
  await project.save();
  res.json({ success: true, project });
});

// @route PATCH /api/projects/:projectId
export const updateProject = asyncHandler(async (req, res) => {
  const project = req.project;
  const { name, description, readme } = req.body;
  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (readme !== undefined) project.readme = readme;
  await project.save();
  res.json({ success: true, project });
});

// @route PATCH /api/projects/:projectId/visibility
export const toggleVisibility = asyncHandler(async (req, res) => {
  const project = req.project;
  if (project.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("Only the project owner can change visibility");
  }
  project.isPublic = !project.isPublic;
  await project.save();
  res.json({ success: true, isPublic: project.isPublic, publicSlug: project.publicSlug });
});

// @route GET /api/public/:slug  (no auth)
export const getPublicProject = asyncHandler(async (req, res) => {
  const project = await Project.findOne({ publicSlug: req.params.slug, isPublic: true }).populate(
    "owner",
    "name avatar"
  );
  if (!project) {
    res.status(404);
    throw new Error("Public project not found or not shared");
  }
  const notes = await Note.find({ project: project._id }).select("title content tags createdAt");
  res.json({
    success: true,
    project: {
      name: project.name,
      description: project.description,
      readme: project.readme,
      owner: project.owner,
      createdAt: project.createdAt,
    },
    notes,
  });
});

// @route GET /api/projects/:projectId/analytics
export const getAnalytics = asyncHandler(async (req, res) => {
  const project = req.project;
  const projectId = project._id;

  const [noteCounts, fileCounts] = await Promise.all([
    Note.aggregate([{ $match: { project: projectId } }, { $group: { _id: "$author", count: { $sum: 1 } } }]),
    FileItem.aggregate([{ $match: { project: projectId } }, { $group: { _id: "$uploader", count: { $sum: 1 } } }]),
  ]);

  const memberIds = [project.owner, ...project.members.map((m) => m.user)];
  const users = await User.find({ _id: { $in: memberIds } }).select("name email avatar");

  const contribution = users.map((u) => {
    const notes = noteCounts.find((n) => n._id?.toString() === u._id.toString())?.count || 0;
    const files = fileCounts.find((f) => f._id?.toString() === u._id.toString())?.count || 0;
    return { user: { _id: u._id, name: u.name, avatar: u.avatar }, notes, files, total: notes + files };
  });

  res.json({
    success: true,
    contribution,
    totals: {
      notes: noteCounts.reduce((a, b) => a + b.count, 0),
      files: fileCounts.reduce((a, b) => a + b.count, 0),
    },
    recentActivity: project.activityLog.slice(-20).reverse(),
  });
});

export { logActivity };
