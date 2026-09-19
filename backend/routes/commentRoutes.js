import express from "express";
import { protect } from "../middleware/auth.js";
import { deleteComment } from "../controllers/commentController.js";

const router = express.Router();
router.use(protect);

router.delete("/:commentId", deleteComment);

export default router;