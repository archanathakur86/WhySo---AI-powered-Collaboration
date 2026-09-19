import jwt from "jsonwebtoken";
import asyncHandler from "express-async-handler";
import User from "../models/User.js";

export const protect = asyncHandler(async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer")) {
    try {
      token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select("-password");
      if (!req.user) {
        res.status(401);
        throw new Error("User not found");
      }
      return next();
    } catch (error) {
      res.status(401);
      throw new Error("Not authorized, token invalid or expired");
    }
  }

  res.status(401);
  throw new Error("Not authorized, no token provided");
});

// Restrict route to project owner/editor
export const requireProjectRole = (allowedRoles = ["owner", "editor", "viewer"]) =>
  asyncHandler(async (req, res, next) => {
    const project = req.project; // attached by a prior loadProject middleware
    if (!project) {
      res.status(404);
      throw new Error("Project not found in request context");
    }
    const isOwner = project.owner.toString() === req.user._id.toString();
    const member = project.members.find((m) => m.user.toString() === req.user._id.toString());
    const role = isOwner ? "owner" : member?.role;

    if (!role || !allowedRoles.includes(role)) {
      res.status(403);
      throw new Error("You do not have permission to perform this action");
    }
    req.userRole = role;
    next();
  });
