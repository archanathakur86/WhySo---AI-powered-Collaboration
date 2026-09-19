import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Conversation from "../models/Conversation.js";
import Project from "../models/Project.js";
import User from "../models/User.js";
import { fastCompletion } from "../services/groqService.js";

const MAX_HISTORY = 20; // messages kept per conversation for context window

// Normalizes an incoming projectId (from body or query) to either a valid
// ObjectId or null. Also verifies the user actually belongs to that project,
// so someone can't read/write another user's project conversation.
const resolveProject = async (rawProjectId, userId) => {
  if (!rawProjectId || !mongoose.Types.ObjectId.isValid(rawProjectId)) return null;

  const project = await Project.findById(rawProjectId).select("name owner members");
  if (!project) return null;

  const isOwner = project.owner.toString() === userId.toString();
  const isMember = project.members.some((m) => m.user.toString() === userId.toString());
  if (!isOwner && !isMember) return null;

  return project;
};

const buildSystemPrompt = (user, project) => {
  const memoryLine =
    user.memoryFacts && user.memoryFacts.length
      ? `Known facts about the user: ${user.memoryFacts.join("; ")}.`
      : "";
  const projectLine = project
    ? `You are currently helping the user inside their project called "${project.name}". Answer with that project's context in mind when relevant.`
    : "You are currently in the general workspace, not inside any specific project.";

  return `You are Sphere, the built-in AI assistant for WhySo, a developer collaboration platform. The user's name is ${user.name}. Greet or address them by name naturally sometimes, but don't overdo it every message. ${projectLine} Keep answers concise and conversational since responses may be read aloud via text-to-speech - avoid long lists, avoid markdown symbols like asterisks or hashes, prefer short plain sentences. ${memoryLine} If the user shares a new fact about themselves worth remembering (preferences, their role, ongoing project), note it naturally in your reply but keep it brief.`;
};

// @route POST /api/assistant/chat
// body: { message: string, projectId?: string }
export const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, projectId } = req.body;
  if (!message || !message.trim()) {
    res.status(400);
    throw new Error("Message cannot be empty");
  }

  const project = await resolveProject(projectId, req.user._id);
  const projectKey = project ? project._id : null;

  let conversation = await Conversation.findOne({ user: req.user._id, project: projectKey });
  if (!conversation) {
    conversation = await Conversation.create({ user: req.user._id, project: projectKey, messages: [] });
  }

  const systemPrompt = buildSystemPrompt(req.user, project);

  const recentHistory = conversation.messages.slice(-MAX_HISTORY).map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));

  const messages = [{ role: "system", content: systemPrompt }, ...recentHistory, { role: "user", content: message }];

  let reply;
  try {
    reply = await fastCompletion(messages, { maxTokens: 300, temperature: 0.6 });
  } catch (err) {
    res.status(502);
    throw new Error("Sphere couldn't respond right now. Please try again.");
  }

  conversation.messages.push({ role: "user", content: message });
  conversation.messages.push({ role: "assistant", content: reply });
  if (conversation.messages.length > 60) {
    conversation.messages = conversation.messages.slice(-60);
  }
  await conversation.save();

  res.json({ success: true, reply, userName: req.user.name, projectId: projectKey });
});

// @route GET /api/assistant/history?projectId=...
export const getAssistantHistory = asyncHandler(async (req, res) => {
  const project = await resolveProject(req.query.projectId, req.user._id);
  const projectKey = project ? project._id : null;
  const conversation = await Conversation.findOne({ user: req.user._id, project: projectKey });
  res.json({ success: true, messages: conversation?.messages || [] });
});

// @route DELETE /api/assistant/history?projectId=...
export const clearAssistantHistory = asyncHandler(async (req, res) => {
  const project = await resolveProject(req.query.projectId, req.user._id);
  const projectKey = project ? project._id : null;
  await Conversation.findOneAndUpdate(
    { user: req.user._id, project: projectKey },
    { messages: [] },
    { upsert: true }
  );
  res.json({ success: true, message: "Conversation history cleared" });
});

// @route POST /api/assistant/remember  { fact: string }
export const rememberFact = asyncHandler(async (req, res) => {
  const { fact } = req.body;
  if (!fact || !fact.trim()) {
    res.status(400);
    throw new Error("Fact cannot be empty");
  }
  const user = await User.findById(req.user._id);
  user.memoryFacts.push(fact.trim());
  if (user.memoryFacts.length > 20) user.memoryFacts = user.memoryFacts.slice(-20);
  await user.save();
  res.json({ success: true, memoryFacts: user.memoryFacts });
});