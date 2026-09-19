import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";

const TEXT_EXTENSIONS = ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "md", "txt", "json", "html", "css"];

export const isTextFile = (filename = "") => {
  const ext = filename.split(".").pop()?.toLowerCase();
  return TEXT_EXTENSIONS.includes(ext);
};

export const getExtension = (filename = "") => filename.split(".").pop()?.toLowerCase() || "";

export const uploadBufferToCloudinary = (buffer, folder = "whyso") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};
