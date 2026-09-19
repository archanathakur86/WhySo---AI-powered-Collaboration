import express from "express";
import { protect } from "../middleware/auth.js";
import { updateNote, deleteNote, explainNote, improveNote } from "../controllers/noteController.js";
import { extractTasksFromNote } from "../controllers/aiController.js";

const router = express.Router();
router.use(protect);

router.route("/:noteId").patch(updateNote).delete(deleteNote);
router.post("/:noteId/explain", explainNote);
router.post("/:noteId/improve", improveNote);
router.post("/:noteId/extract-tasks", extractTasksFromNote);

export default router;
