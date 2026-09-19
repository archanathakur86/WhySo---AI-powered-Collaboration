import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

export default function CommentsPanel({ projectId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

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
      <p className="text-xs text-slate-400 mb-3">Open to all project members — owners, editors, viewers, and commentors.</p>

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
                <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{c.content}</p>
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

      <form onSubmit={handlePost} className="flex gap-2">
        <input
          className="input text-sm"
          placeholder="Write a comment..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary text-sm" disabled={posting}>
          {posting ? "Posting..." : "Post"}
        </button>
      </form>
    </div>
  );
}