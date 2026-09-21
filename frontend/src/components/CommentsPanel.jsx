import React, { useEffect, useState, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

// Renders comment text with @mentions highlighted in brand color
function renderWithMentions(text) {
  const parts = text.split(/(@[\w.+-]+@[\w.-]+\.\w+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-brand-600 font-medium">
        {part}
      </span>
    ) : (
      part
    )
  );
}

export default function CommentsPanel({ projectId, project }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState(null);
  const inputRef = useRef(null);

  // Everyone who can be @mentioned: the owner + all invited members
  const mentionable = useMemo(() => {
    if (!project) return [];
    const list = [];
    if (project.owner?.email) list.push({ name: project.owner.name, email: project.owner.email, role: "owner" });
    (project.members || []).forEach((m) => {
      if (m.user?.email) list.push({ name: m.user.name, email: m.user.email, role: m.role });
    });
    return list;
  }, [project]);

  const filteredMentions = useMemo(() => {
    if (!mentionQuery) return mentionable;
    const q = mentionQuery.toLowerCase();
    return mentionable.filter(
      (m) => m.email.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)
    );
  }, [mentionable, mentionQuery]);

  const loadComments = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/comments`);
      setComments(res.data.comments);
    } catch (err) {
      toast.error("Failed to load comments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, [projectId]);

  // Detect "@" being typed to trigger the mention dropdown
  const handleTextChange = (e) => {
    const value = e.target.value;
    const cursorPos = e.target.selectionStart;
    setText(value);

    const uptoCursor = value.slice(0, cursorPos);
    const atMatch = uptoCursor.match(/@([\w.@-]*)$/);

    if (atMatch) {
      setShowMentions(true);
      setMentionQuery(atMatch[1]);
      setMentionStart(cursorPos - atMatch[1].length - 1);
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (email) => {
    const before = text.slice(0, mentionStart);
    const after = text.slice(inputRef.current.selectionStart);
    const newText = `${before}@${email} ${after}`;
    setText(newText);
    setShowMentions(false);
    // refocus after the inserted mention
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      const pos = before.length + email.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handlePost = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setPosting(true);
    try {
      const res = await api.post(`/projects/${projectId}/comments`, { content: text });
      setComments((prev) => [...prev, res.data.comment]);
      setText("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to post comment");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/comments/${id}`);
      setComments((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete comment");
    }
  };

  return (
    <div className="card">
      <h4 className="font-semibold mb-3">Discussion</h4>
      <p className="text-xs text-slate-400 mb-3">
        Open to all project members — owners, editors, viewers, and commentors. Type @ to mention someone.
      </p>

      {loading ? (
        <p className="text-sm text-slate-400">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="text-sm text-slate-400 mb-3">No comments yet. Start the discussion below.</p>
      ) : (
        <div className="space-y-3 mb-4 max-h-80 overflow-y-auto">
          {comments.map((c) => (
            <div key={c._id} className="flex items-start justify-between bg-slate-50 rounded-lg p-3">
              <div>
                <p className="text-sm">
                  <span className="font-medium">{c.author?.name || "Unknown"}</span>{" "}
                  <span className="text-xs text-slate-400">{new Date(c.createdAt).toLocaleString()}</span>
                </p>
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{renderWithMentions(c.content)}</p>
              </div>
              {c.author?._id === user?._id && (
                <button
                  onClick={() => handleDelete(c._id)}
                  className="text-xs text-red-500 hover:underline flex-shrink-0 ml-2"
                >
                  Delete
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handlePost} className="flex gap-2 relative">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            className="input text-sm"
            placeholder="Write a comment... use @ to mention a member"
            value={text}
            onChange={handleTextChange}
            onBlur={() => setTimeout(() => setShowMentions(false), 150)}
          />
          {showMentions && filteredMentions.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 w-full max-w-xs bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto z-10">
              {filteredMentions.map((m) => (
                <button
                  key={m.email}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectMention(m.email);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm flex flex-col"
                >
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-slate-400">
                    {m.email} · {m.role}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="btn btn-primary text-sm" disabled={posting}>
          {posting ? "Posting..." : "Post"}
        </button>
      </form>
    </div>
  );
}