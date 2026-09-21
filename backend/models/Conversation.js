import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One document = one chat (like a ChatGPT conversation).
// A user can now have MANY conversations.
const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" }, // auto-generated from the first message
    messages: [messageSchema], // capped in controller logic
  },
  { timestamps: true }
);

// Fast "list my chats, newest first"
conversationSchema.index({ user: 1, updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

// The old version of this model had `unique: true` on `user` (only one chat per
// user). That unique index still exists in MongoDB and would block creating a
// 2nd chat, so we sync indexes once on startup to drop it.
Conversation.syncIndexes().catch((err) =>
  console.warn("Conversation index sync skipped:", err.message)
);

export default Conversation;