import express from "express";
import { protect } from "../middleware/auth.js";
import { updateTask, deleteTask } from "../controllers/aiController.js";

const router = express.Router();
router.use(protect);

router.route("/:taskId").patch(updateTask).delete(deleteTask);

export default router;
