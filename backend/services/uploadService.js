import streamifier from "streamifier";
import cloudinary from "../config/cloudinary.js";

// Keep in sync with CODE_EXTENSIONS in frontend/src/components/FileList.jsx
const TEXT_EXTENSIONS = [
  "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "cs", "go", "rs", "rb", "php",
  "sh", "sql", "yml", "yaml", "vue", "md", "txt", "json", "html", "css",
];

const INLINE_MIME = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export const isTextFile = (filename = "") => {
  const ext = filename.split(".").pop()?.toLowerCase();
  return TEXT_EXTENSIONS.includes(ext);
};

export const getExtension = (filename = "") => filename.split(".").pop()?.toLowerCase() || "";

// Content-Type used when we stream a stored file back to the browser.
// Text/code is always served as text/plain (never text/html) so an uploaded
// .html file can't run scripts inside our app; unknown types become downloads.
export const contentTypeFor = (ext = "") =>
  INLINE_MIME[ext] || (TEXT_EXTENSIONS.includes(ext) ? "text/plain; charset=utf-8" : "application/octet-stream");

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

// Cloudinary stores PDFs/images under "image", code & other files under "raw".
// The resource type isn't saved on FileItem, but it is always part of the URL:
//   https://res.cloudinary.com/<cloud>/<resource_type>/upload/v123/<folder>/<id>.<ext>
export const parseCloudinaryUrl = (url = "") => {
  const m = url.match(/\/(image|video|raw)\/(upload|private|authenticated)\//);
  const resourceType = m ? m[1] : "image";
  const type = m ? m[2] : "upload";
  const ext = url.split("?")[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  // raw public_ids already include the extension, image/video ones don't
  return { resourceType, type, format: resourceType === "raw" ? undefined : ext };
};

export const deleteFromCloudinary = async (publicId, url = "") => {
  if (!publicId) return;
  try {
    const { resourceType, type } = parseCloudinaryUrl(url);
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type });
  } catch (err) {
    console.error("Cloudinary delete error:", err.message);
  }
};

const fetchBuffer = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    const err = new Error(`Storage responded with ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return Buffer.from(await response.arrayBuffer());
};

// Reads a stored file's bytes server-side.
// 1) Try the normal delivery URL.
// 2) If Cloudinary refuses it (401/403 — e.g. PDF/ZIP delivery is disabled on
//    the account), retry through a short-lived, signed Admin-API download URL.
export const fetchStoredFile = async (file) => {
  try {
    return await fetchBuffer(file.url);
  } catch (directErr) {
    if (!file.publicId) throw directErr;
    const { resourceType, type, format } = parseCloudinaryUrl(file.url);
    const signedUrl = cloudinary.utils.private_download_url(file.publicId, format, {
      resource_type: resourceType,
      type,
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });
    return fetchBuffer(signedUrl);
  }
};