import mongoose from "mongoose";

const riskSchema = new mongoose.Schema(
  {
    severity: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    description: { type: String, required: true },
  },
  { _id: false }
);

// Saved AI code review for this specific version of the file, so teammates
// can read it later without re-running the AI.
const reviewSchema = new mongoose.Schema(
  {
    summary: { type: String, default: "" },
    riskLevel: { type: String, enum: ["low", "medium", "high"], default: "low" },
    risks: [riskSchema],
    suggestions: [String],
    comparedWithVersion: { type: Number, default: null }, // null => first version, whole file reviewed
    addedLines: { type: Number, default: 0 },
    removedLines: { type: Number, default: 0 },
    truncated: { type: Boolean, default: false }, // true if the file/diff was too long and was cut before review
    generatedAt: { type: Date },
  },
  { _id: false }
);

const fileSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    uploader: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    url: { type: String, required: true }, // cloudinary url
    publicId: { type: String }, // cloudinary public id (for versioning/deletion)
    fileType: { type: String }, // extension e.g. js, py, png
    textContent: { type: String, default: "" }, // extracted text for code/text files, used for diffing + AI
    version: { type: Number, default: 1 },
    previousVersionId: { type: mongoose.Schema.Types.ObjectId, ref: "FileItem", default: null },
    review: { type: reviewSchema, default: null },
  },
  { timestamps: true }
);

export default mongoose.model("FileItem", fileSchema);