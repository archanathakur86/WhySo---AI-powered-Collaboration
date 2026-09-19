import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import api from "../api/axios.js";

function NoteCard({ note, onDeleted, onUpdated }) {
  const [aiResult, setAiResult] = useState(null);
  const [aiLabel, setAiLabel] = useState("");
  const [loadingAction, setLoadingAction] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(note.title);
  const [editContent, setEditContent] = useState(note.content);
  const [saving, setSaving] = useState(false);

  const runAction = async (action) => {
    setLoadingAction(action);
    setAiResult(null);
    try {
      if (action === "explain") {
        const res = await api.post(`/notes/${note._id}/explain`);
        setAiResult(res.data.explanation);
        setAiLabel("Explanation");
      } else if (action === "improve") {
        const res = await api.post(`/notes/${note._id}/improve`);
        setAiResult(res.data.suggestions);
        setAiLabel("Suggested Improvements");
      } else if (action === "tasks") {
        const res = await api.post(`/notes/${note._id}/extract-tasks`);
        if (res.data.tasks.length === 0) {
          toast(res.data.message || "No action items found");
        } else {
          toast.success(`${res.data.tasks.length} task(s) extracted! Check the Tasks tab.`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "AI action failed");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/notes/${note._id}`);
      toast.success("Note deleted");
      onDeleted(note._id);
    } catch (err) {
      toast.error("Failed to delete note");
    } finally {
      setConfirmingDelete(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error("Title and content cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/notes/${note._id}`, { title: editTitle, content: editContent });
      toast.success("Note updated");
      onUpdated(res.data.note);
      setIsEditing(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update note");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setEditTitle(note.title);
    setEditContent(note.content);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="card space-y-3 border-brand-200 ring-1 ring-brand-100">
        <input className="input font-medium" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
        <textarea
          className="input font-mono text-sm"
          rows={6}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="btn btn-primary text-sm" onClick={handleSaveEdit} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
          <button className="btn btn-secondary text-sm" onClick={cancelEdit} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">{note.title}</h4>
          <p className="text-xs text-slate-400">
            By {note.author?.name || "Unknown"} · {new Date(note.createdAt).toLocaleString()}
            {note.updatedAt && note.updatedAt !== note.createdAt && (
              <span> · edited {new Date(note.updatedAt).toLocaleString()}</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button onClick={() => setIsEditing(true)} className="text-xs text-brand-600 hover:underline">
            Edit
          </button>
          <button onClick={() => setConfirmingDelete(true)} className="text-xs text-red-500 hover:underline">
            Delete
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm flex items-center justify-between gap-3">
          <p className="text-amber-800">
            ⚠️ This will permanently delete "<span className="font-medium">{note.title}</span>". This action cannot be undone.
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button onClick={handleDelete} className="btn text-xs py-1 px-3 bg-red-600 text-white hover:bg-red-700">
              Delete
            </button>
            <button onClick={() => setConfirmingDelete(false)} className="btn btn-secondary text-xs py-1 px-3">
              Cancel
            </button>
          </div>
        </div>
      )}

      {note.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {note.tags.map((t) => (
            <span key={t} className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className={`prose prose-sm max-w-none mt-3 ${expanded ? "" : "line-clamp-4"}`}>
        <ReactMarkdown>{note.content}</ReactMarkdown>
      </div>
      <button className="text-xs text-brand-600 mt-1" onClick={() => setExpanded((e) => !e)}>
        {expanded ? "Show less" : "Show more"}
      </button>

      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn btn-secondary text-xs py-1" disabled={loadingAction} onClick={() => runAction("explain")}>
          {loadingAction === "explain" ? "Explaining..." : "🧠 Explain"}
        </button>
        <button className="btn btn-secondary text-xs py-1" disabled={loadingAction} onClick={() => runAction("improve")}>
          {loadingAction === "improve" ? "Thinking..." : "✨ Improve"}
        </button>
        <button className="btn btn-secondary text-xs py-1" disabled={loadingAction} onClick={() => runAction("tasks")}>
          {loadingAction === "tasks" ? "Extracting..." : "✅ Extract Tasks"}
        </button>
      </div>

      {aiResult && (
        <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-3 text-sm">
          <p className="font-medium text-brand-700 mb-1">{aiLabel}</p>
          <div className="whitespace-pre-wrap text-slate-700">{aiResult}</div>
        </div>
      )}
    </div>
  );
}

export default function NotesList({ notes, onDeleted, onUpdated }) {
  if (notes.length === 0) {
    return <div className="card text-center py-8 text-slate-500">No notes yet. Add your first one above.</div>;
  }
  return (
    <div className="space-y-3">
      {notes.map((n) => (
        <NoteCard key={n._id} note={n} onDeleted={onDeleted} onUpdated={onUpdated} />
      ))}
    </div>
  );
}
