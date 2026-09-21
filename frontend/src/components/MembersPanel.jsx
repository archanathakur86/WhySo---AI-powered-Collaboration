import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";

export default function MembersPanel({ project, currentUserId, onUpdated }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyPublicUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy automatically — please copy manually");
    }
  };

  const isOwner = project.owner?._id === currentUserId || project.owner === currentUserId;

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("Enter an email");
    setAdding(true);
    try {
      const res = await api.post(`/projects/${project._id}/members`, { email, role });
      toast.success("Member added");
      setEmail("");
      onUpdated(res.data.project);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (userId) => {
    try {
      const res = await api.delete(`/projects/${project._id}/members/${userId}`);
      toast.success("Member removed");
      onUpdated(res.data.project);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member");
    }
  };

  const toggleVisibility = async () => {
    try {
      const res = await api.patch(`/projects/${project._id}/visibility`);
      toast.success(res.data.isPublic ? "Project is now public" : "Project is now private");
      onUpdated({ ...project, isPublic: res.data.isPublic, publicSlug: res.data.publicSlug });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to change visibility");
    }
  };

  const publicUrl = project.publicSlug ? `${window.location.origin}/public/${project.publicSlug}` : "";

  return (
    <div className="space-y-4">
      <div className="card">
        <h4 className="font-semibold mb-3">Members</h4>
        <ul className="space-y-2">
          <li className="flex items-center justify-between text-sm">
            <span>{project.owner?.name} <span className="text-xs text-slate-400">(owner)</span></span>
          </li>
          {project.members?.map((m) => (
            <li key={m.user._id} className="flex items-center justify-between text-sm">
              <span>
                {m.user.name} <span className="text-xs text-slate-400">({m.role})</span>
              </span>
              {isOwner && (
                <button onClick={() => handleRemove(m.user._id)} className="text-xs text-red-500 hover:underline">
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {isOwner && (
          <form onSubmit={handleAdd} className="flex gap-2 mt-4">
            <input
              className="input text-sm"
              placeholder="teammate@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <select className="input text-sm w-32" value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="btn btn-primary text-sm whitespace-nowrap" disabled={adding}>
              {adding ? "Adding..." : "Invite"}
            </button>
          </form>
        )}

        {isOwner && (
          <div className="mt-4 text-xs text-slate-500 bg-slate-50 rounded-lg p-3 space-y-1">
            <p><span className="font-medium text-slate-700">Editor</span> — can create/edit notes, upload files, and comment.</p>
            <p><span className="font-medium text-slate-700">Viewer</span> — can view everything and comment, but can't edit.</p>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="card">
          <h4 className="font-semibold mb-2">Public Sharing</h4>
          <p className="text-sm text-slate-500 mb-3">
            Make this project's README and notes viewable via a public read-only link.
          </p>
          <button className="btn btn-secondary text-sm" onClick={toggleVisibility}>
            {project.isPublic ? "Make Private" : "Make Public"}
          </button>
          {project.isPublic && publicUrl && (
            <div className="mt-3 flex items-center gap-2 text-sm bg-slate-50 border border-slate-200 rounded-lg p-2">
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  copyPublicUrl(publicUrl);
                }}
                className="text-brand-600 hover:underline break-all flex-1"
                title="Click to open, double-click to copy"
              >
                {publicUrl}
              </a>
              <button
                onClick={() => copyPublicUrl(publicUrl)}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-brand-600"
                title="Copy link"
                aria-label="Copy public link"
              >
                {copied ? "✅" : "📋"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
