import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, default: "" }, // markdown
    tags: [{ type: String }], // AI-generated tags
    embedding: [{ type: Number }], // for semantic search
  },
  { timestamps: true }
);

noteSchema.index({ title: "text", content: "text" });

export default mongoose.model("Note", noteSchema);
