import mongoose from "mongoose";

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
  },
  { timestamps: true }
);

export default mongoose.model("FileItem", fileSchema);
