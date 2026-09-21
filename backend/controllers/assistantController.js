import mongoose from "mongoose";
import asyncHandler from "express-async-handler";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import { fastCompletion } from "../services/groqService.js";

const MAX_HISTORY = 20; // messages sent to the model as context
const MAX_STORED = 100; // messages kept per conversation
const MAX_CONVERSATIONS = 100; // conversations returned in the sidebar

const makeTitle = (text = "") => {
  const clean = text.trim().replace(/\s+/g, " ");
  return clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean || "New chat";
};

const buildSystemPrompt = (user) => {
  const memoryLine =
    user.memoryFacts && user.memoryFacts.length
      ? `Known facts about the user: ${user.memoryFacts.join("; ")}.`
      : "";
  return `You are Sphere, the built-in AI assistant for WhySo, a developer collaboration platform. The user's name is ${user.name}. Greet or address them by name naturally sometimes, but don't overdo it every message. The user can have many separate chats with you, so focus on the current conversation. Keep answers concise and conversational since responses may be read aloud via text-to-speech - avoid long lists, avoid markdown symbols like asterisks or hashes, prefer short plain sentences. ${memoryLine} If the user shares a new fact about themselves worth remembering (preferences, their role, ongoing project), note it naturally in your reply but keep it brief.`;
};

// Loads a conversation that belongs to the logged-in user, or throws 404.
const findOwnedConversation = async (id, userId, res) => {
  if (!mongoose.isValidObjectId(id)) {
    res.status(404);
    throw new Error("Conversation not found");
  }
  const conversation = await Conversation.findOne({ _id: id, user: userId });
  if (!conversation) {
    res.status(404);
    throw new Error("Conversation not found");
  }
  return conversation;
};

// @route POST /api/assistant/chat
// body: { message: string, conversationId?: string }
// - no conversationId  -> starts a NEW chat
// - with conversationId -> continues that chat
export const chatWithAssistant = asyncHandler(async (req, res) => {
  const { message, conversationId } = req.body;
  if (!message || !message.trim()) {
    res.status(400);
    throw new Error("Message cannot be empty");
  }

  let conversation = null;
  if (conversationId) {
    conversation = await findOwnedConversation(conversationId, req.user._id, res);
  }

  const systemPrompt = buildSystemPrompt(req.user);

  const recentHistory = (conversation ? conversation.messages.slice(-MAX_HISTORY) : []).map((m) => ({
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

  // Groq occasionally returns an empty string instead of throwing — treat
  // that the same as a failure instead of letting it crash on save.
  if (!reply || !reply.trim()) {
    res.status(502);
    throw new Error("Sphere didn't have anything to say — please try rephrasing your message.");
  }

  // Only create the conversation once we have a real reply, so failed
  // first messages don't leave empty chats behind.
  if (!conversation) {
    conversation = new Conversation({
      user: req.user._id,
      title: makeTitle(message),
      messages: [],
    });
  } else if (!conversation.title) {
    // older chats created before titles existed
    conversation.title = makeTitle(conversation.messages[0]?.content || message);
  }

  conversation.messages.push({ role: "user", content: message });
  conversation.messages.push({ role: "assistant", content: reply });
  if (conversation.messages.length > MAX_STORED) {
    conversation.messages = conversation.messages.slice(-MAX_STORED);
  }
  await conversation.save();

  res.json({
    success: true,
    reply,
    userName: req.user.name,
    conversationId: conversation._id,
    title: conversation.title,
  });
});

// @route GET /api/assistant/conversations
// Sidebar list — newest first, without the full messages.
export const listConversations = asyncHandler(async (req, res) => {
  const docs = await Conversation.find({ user: req.user._id, "messages.0": { $exists: true } })
    .sort({ updatedAt: -1 })
    .limit(MAX_CONVERSATIONS)
    .select({ title: 1, updatedAt: 1, createdAt: 1, messages: { $slice: 1 } });

  const conversations = docs.map((c) => ({
    _id: c._id,
    title: c.title || makeTitle(c.messages?.[0]?.content),
    updatedAt: c.updatedAt,
    createdAt: c.createdAt,
  }));

  res.json({ success: true, conversations });
});

// @route GET /api/assistant/conversations/:id
export const getConversation = asyncHandler(async (req, res) => {
  const conversation = await findOwnedConversation(req.params.id, req.user._id, res);
  res.json({
    success: true,
    conversation: {
      _id: conversation._id,
      title: conversation.title,
      messages: conversation.messages,
      updatedAt: conversation.updatedAt,
    },
  });
});

// @route DELETE /api/assistant/conversations/:id
export const deleteConversation = asyncHandler(async (req, res) => {
  const conversation = await findOwnedConversation(req.params.id, req.user._id, res);
  await conversation.deleteOne();
  res.json({ success: true, message: "Conversation deleted" });
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