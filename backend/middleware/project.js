import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Project from "../models/Project.js";

// Loads project by :projectId param, checks user is a member/owner, attaches to req.project
export const loadProject = asyncHandler(async (req, res, next) => {
  const { projectId } = req.params;
  if (!mongoose.Types.ObjectId.isValid(projectId)) {
    res.status(400);
    throw new Error("Invalid project id");
  }

  const project = await Project.findById(projectId);
  if (!project) {
    res.status(404);
    throw new Error("Project not found");
  }

  const isOwner = project.owner.toString() === req.user._id.toString();
  const isMember = project.members.some((m) => m.user.toString() === req.user._id.toString());

  if (!isOwner && !isMember) {
    res.status(403);
    throw new Error("You are not a member of this project");
  }

  req.project = project;
  next();
});
