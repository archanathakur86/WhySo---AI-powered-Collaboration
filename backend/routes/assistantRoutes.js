import express from "express";
import { protect } from "../middleware/auth.js";
import {
  chatWithAssistant,
  listConversations,
  getConversation,
  deleteConversation,
  rememberFact,
} from "../controllers/assistantController.js";

const router = express.Router();
router.use(protect);

router.post("/chat", chatWithAssistant);
router.get("/conversations", listConversations);
router.get("/conversations/:id", getConversation);
router.delete("/conversations/:id", deleteConversation);
router.post("/remember", rememberFact);


export default router;