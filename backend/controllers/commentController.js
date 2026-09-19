import asyncHandler from "express-async-handler";
import Comment from "../models/Comment.js";

// @route GET /api/projects/:projectId/comments
export const getComments = asyncHandler(async (req, res) => {
  const comments = await Comment.find({ project: req.project._id })
    .populate("author", "name avatar")
    .sort({ createdAt: 1 });
  res.json({ success: true, comments });
});

// @route POST /api/projects/:projectId/comments
export const addComment = asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim()) {
    res.status(400);
    throw new Error("Comment cannot be empty");
  }

  const comment = await Comment.create({
    project: req.project._id,
    author: req.user._id,
    content: content.trim(),
  });

  const populated = await comment.populate("author", "name avatar");
  res.status(201).json({ success: true, comment: populated });
});

// @route DELETE /api/comments/:commentId  (author or project owner only)
export const deleteComment = asyncHandler(async (req, res) => {
  const comment = await Comment.findById(req.params.commentId);
  if (!comment) {
    res.status(404);
    throw new Error("Comment not found");
  }
  if (comment.author.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error("You can only delete your own comments");
  }
  await comment.deleteOne();
  res.json({ success: true, message: "Comment deleted" });
});