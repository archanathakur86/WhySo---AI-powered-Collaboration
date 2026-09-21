import React, { useState, useRef } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";

export default function FileUpload({ projectId, onUploaded }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef();

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setUploading(true);
    try {
      const res = await api.post(`/projects/${projectId}/files`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded = res.data.file;
      toast.success(uploaded.version > 1 ? `Uploaded as new version v${uploaded.version}` : "File uploaded");
      // `_justUploaded` tells the file card to auto-run the AI review for new versions of code files
      onUploaded({ ...uploaded, _justUploaded: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="card">
      <label className="block text-sm font-medium mb-2">Upload code file or asset</label>
      <input ref={inputRef} type="file" onChange={handleFile} disabled={uploading} className="text-sm" />
      <p className="text-xs text-slate-400 mt-2">
        Tip: upload a file with the same name again to save it as a new version — AI will compare it with the previous
        one and review the changes.
      </p>
      {uploading && <p className="text-xs text-brand-600 mt-2">Uploading to cloud storage...</p>}
    </div>
  );
}