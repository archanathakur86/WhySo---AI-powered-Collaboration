import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // null = the "general" assistant chat (used outside any specific project, e.g. on the dashboard)
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    messages: [messageSchema], // capped to last 60 in controller logic
  },
  { timestamps: true }
);

// one conversation per user per project (and one per user for the general/no-project chat)
conversationSchema.index({ user: 1, project: 1 }, { unique: true });

export default mongoose.model("Conversation", conversationSchema);