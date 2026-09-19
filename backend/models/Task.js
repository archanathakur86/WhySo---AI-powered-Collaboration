import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    sourceNote: { type: mongoose.Schema.Types.ObjectId, ref: "Note", default: null },
    title: { type: String, required: true },
    assigneeGuess: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["todo", "in-progress", "done"], default: "todo" },
    createdBy: { type: String, enum: ["ai", "user"], default: "ai" },
  },
  { timestamps: true }
);

export default mongoose.model("Task", taskSchema);
