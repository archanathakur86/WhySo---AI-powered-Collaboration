import express from "express";
import { protect } from "../middleware/auth.js";
import {
  chatWithAssistant,
  getAssistantHistory,
  clearAssistantHistory,
  rememberFact,
} from "../controllers/assistantController.js";

const router = express.Router();
router.use(protect);

router.post("/chat", chatWithAssistant);
router.get("/history", getAssistantHistory);
router.delete("/history", clearAssistantHistory);
router.post("/remember", rememberFact);

export default router;
