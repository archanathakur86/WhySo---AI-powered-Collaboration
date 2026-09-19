import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";

function FileCard({ file, onDeleted }) {
  const [aiResult, setAiResult] = useState(null);
  const [aiLabel, setAiLabel] = useState("");
  const [loadingAction, setLoadingAction] = useState(null);

  const runAction = async (action) => {
    setLoadingAction(action);
    setAiResult(null);
    try {
      if (action === "explain") {
        const res = await api.post(`/files/${file._id}/explain`);
        setAiResult(res.data.explanation);
        setAiLabel("Code Explanation");
      } else if (action === "review") {
        const res = await api.post(`/files/${file._id}/review`);
        setAiResult(res.data.review);
        setAiLabel(res.data.hasComparison ? "AI Code Review (vs previous version)" : "AI Code Review (first version)");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "AI action failed");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${file.originalName}?`)) return;
    try {
      await api.delete(`/files/${file._id}`);
      toast.success("File deleted");
      onDeleted(file._id);
    } catch (err) {
      toast.error("Failed to delete file");
    }
  };

  const isCode = !!file.fileType && ["js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "html", "css", "json", "md"].includes(file.fileType);
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(file.fileType);

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <a href={file.url} target="_blank" rel="noreferrer" className="font-medium text-brand-700 hover:underline">
            {file.originalName}
          </a>
          <p className="text-xs text-slate-400">
            v{file.version} · {file.uploader?.name} · {new Date(file.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">
          Delete
        </button>
      </div>

      {isImage && <img src={file.url} alt={file.originalName} className="mt-2 max-h-40 rounded-lg border" />}

      {isCode && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-secondary text-xs py-1" disabled={loadingAction} onClick={() => runAction("explain")}>
            {loadingAction === "explain" ? "Explaining..." : "🧠 Explain Code"}
          </button>
          <button className="btn btn-secondary text-xs py-1" disabled={loadingAction} onClick={() => runAction("review")}>
            {loadingAction === "review" ? "Reviewing..." : "🔍 AI Code Review"}
          </button>
        </div>
      )}

      {aiResult && (
        <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-3 text-sm">
          <p className="font-medium text-brand-700 mb-1">{aiLabel}</p>
          <div className="whitespace-pre-wrap text-slate-700">{aiResult}</div>
        </div>
      )}
    </div>
  );
}

export default function FileList({ files, onDeleted }) {
  if (files.length === 0) {
    return <div className="card text-center py-8 text-slate-500">No files uploaded yet.</div>;
  }
  return (
    <div className="space-y-3">
      {files.map((f) => (
        <FileCard key={f._id} file={f} onDeleted={onDeleted} />
      ))}
    </div>
  );
}
