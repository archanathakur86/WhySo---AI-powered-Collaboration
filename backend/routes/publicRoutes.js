import express from "express";
import { getPublicProject } from "../controllers/projectController.js";

const router = express.Router();

router.get("/:slug", getPublicProject);

export default router;
