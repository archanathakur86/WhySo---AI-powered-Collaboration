import express from "express";
import { protect } from "../middleware/auth.js";
import { deleteFile, explainFile, reviewFile } from "../controllers/fileController.js";

const router = express.Router();
router.use(protect);

router.delete("/:fileId", deleteFile);
router.post("/:fileId/explain", explainFile);
router.post("/:fileId/review", reviewFile);

export default router;
