import express from "express";
import { protect, requireProjectRole } from "../middleware/auth.js";
import { loadProject } from "../middleware/project.js";
import upload from "../middleware/upload.js";
import {
  createProject,
  getMyProjects,
  getProject,
  addMember,
  removeMember,
  updateProject,
  toggleVisibility,
  getAnalytics,
} from "../controllers/projectController.js";
import { createNote, getNotes } from "../controllers/noteController.js";
import { uploadFile, getFiles } from "../controllers/fileController.js";
import {
  generateProjectReadme,
  weeklyReport,
  projectHealth,
  aiSearch,
  getTasks,
} from "../controllers/aiController.js";
import { getComments, addComment } from "../controllers/commentController.js";

const router = express.Router();

router.use(protect);

router.route("/").post(createProject).get(getMyProjects);

router
  .route("/:projectId")
  .get(loadProject, getProject)
  .patch(loadProject, updateProject);

router.patch("/:projectId/visibility", loadProject, toggleVisibility);
router.post("/:projectId/members", loadProject, addMember);
router.delete("/:projectId/members/:userId", loadProject, removeMember);
router.get("/:projectId/analytics", loadProject, getAnalytics);

// notes - only owner/editor can create; any member can view
router
  .route("/:projectId/notes")
  .post(loadProject, requireProjectRole(["owner", "editor"]), createNote)
  .get(loadProject, getNotes);

// files - only owner/editor can upload; any member can view
router
  .route("/:projectId/files")
  .post(loadProject, requireProjectRole(["owner", "editor"]), upload.single("file"), uploadFile)
  .get(loadProject, getFiles);

// AI project-level features
router.post("/:projectId/ai/readme", loadProject, generateProjectReadme);
router.get("/:projectId/ai/weekly-report", loadProject, weeklyReport);
router.get("/:projectId/ai/health", loadProject, projectHealth);
router.get("/:projectId/ai/search", loadProject, aiSearch);
router.get("/:projectId/tasks", loadProject, getTasks);

// comments - open to any project member (owner/editor/viewer/commentor)
router.route("/:projectId/comments").get(loadProject, getComments).post(loadProject, addComment);

export default router;