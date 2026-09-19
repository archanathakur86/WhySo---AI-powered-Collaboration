import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";

export default function NoteEditor({ projectId, onCreated }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/projects/${projectId}/notes`, { title, content });
      if (res.data.duplicateWarning?.isDuplicate) {
        toast(`⚠️ This looks similar to an existing note: ${res.data.duplicateWarning.reason}`, {
          duration: 5000,
        });
      } else {
        toast.success("Note saved");
      }
      setTitle("");
      setContent("");
      onCreated(res.data.note);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card space-y-3">
      <input
        className="input font-medium"
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input font-mono text-sm"
        rows={6}
        placeholder="Write markdown here... e.g. ## Meeting notes\n- discussed X\n- next step: Y"
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving + AI tagging..." : "Save Note"}
      </button>
    </div>
  );
}
