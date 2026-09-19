import mongoose from "mongoose";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

const memberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["owner", "editor", "viewer", "commentor"], default: "editor" },
  },
  { _id: false }
);

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    action: { type: String }, // e.g. "note_created", "file_uploaded", "member_added"
    detail: { type: String },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [memberSchema],
    isPublic: { type: Boolean, default: false },
    publicSlug: { type: String, unique: true, sparse: true, default: () => nanoid() },
    readme: { type: String, default: "" },
    activityLog: [activityLogSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Project", projectSchema);