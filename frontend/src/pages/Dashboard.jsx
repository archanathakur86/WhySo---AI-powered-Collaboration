import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios.js";

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [creating, setCreating] = useState(false);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get("/projects");
      setProjects(res.data.projects);
    } catch (err) {
      toast.error("Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Project name is required");
    setCreating(true);
    try {
      await api.post("/projects", form);
      toast.success("Project created!");
      setForm({ name: "", description: "" });
      setShowForm(false);
      loadProjects();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Projects</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          + New Project
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="card mb-6 space-y-3">
          <input
            className="input"
            placeholder="Project name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <textarea
            className="input"
            rows={2}
            placeholder="Short description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button className="btn btn-primary" disabled={creating}>
            {creating ? "Creating..." : "Create Project"}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading projects...</p>
      ) : projects.length === 0 ? (
        <div className="card text-center py-12 text-slate-500">
          No projects yet. Create your first one to get started!
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Link to={`/projects/${p._id}`} key={p._id} className="card hover:shadow-md transition-shadow">
              <h3 className="font-semibold text-lg text-brand-700">{p.name}</h3>
              <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.description || "No description"}</p>
              <div className="mt-3 text-xs text-slate-400">Owner: {p.owner?.name}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
