import express from "express";
import { protect } from "../middleware/auth.js";
import { deleteFile, downloadFile, explainFile, reviewFile } from "../controllers/fileController.js";

const router = express.Router();
router.use(protect);

router.get("/:fileId/download", downloadFile);
router.delete("/:fileId", deleteFile);
router.post("/:fileId/explain", explainFile);
router.post("/:fileId/review", reviewFile);

export default router;