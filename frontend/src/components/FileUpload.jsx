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
      toast.success("File uploaded");
      onUploaded(res.data.file);
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
      {uploading && <p className="text-xs text-brand-600 mt-2">Uploading to cloud storage...</p>}
    </div>
  );
}
