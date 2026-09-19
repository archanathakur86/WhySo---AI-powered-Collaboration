import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

import NoteEditor from "../components/NoteEditor.jsx";
import NotesList from "../components/NotesList.jsx";
import FileUpload from "../components/FileUpload.jsx";
import FileList from "../components/FileList.jsx";
import AnalyticsPanel from "../components/AnalyticsPanel.jsx";
import HealthBadge from "../components/HealthBadge.jsx";
import SearchBar from "../components/SearchBar.jsx";
import ReportGenerator from "../components/ReportGenerator.jsx";
import TaskList from "../components/TaskList.jsx";
import MembersPanel from "../components/MembersPanel.jsx";
import CommentsPanel from "../components/CommentsPanel.jsx";

const TABS = ["Notes", "Files", "Tasks", "Search", "Analytics", "AI Reports", "Members", "Discussion"];

export default function ProjectPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [notes, setNotes] = useState([]);
  const [files, setFiles] = useState([]);
  const [tab, setTab] = useState("Notes");
  const [loading, setLoading] = useState(true);
  const [healthRefreshKey, setHealthRefreshKey] = useState(0);

  const bumpHealth = () => setHealthRefreshKey((k) => k + 1);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [projRes, notesRes, filesRes] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/notes`),
        api.get(`/projects/${projectId}/files`),
      ]);
      setProject(projRes.data.project);
      setNotes(notesRes.data.notes);
      setFiles(filesRes.data.files);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (loading) return <div className="max-w-5xl mx-auto px-4 py-10 text-slate-500">Loading project...</div>;
  if (!project) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Link to="/" className="text-sm text-brand-600 hover:underline">
        ← Back to Dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-6">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-slate-500 text-sm">{project.description || "No description"}</p>
        </div>
        <HealthBadge projectId={projectId} refreshKey={healthRefreshKey} />
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Notes" && (
        <div className="space-y-4">
          <NoteEditor
            projectId={projectId}
            onCreated={(n) => {
              setNotes((prev) => [n, ...prev]);
              bumpHealth();
            }}
          />
          <NotesList
            notes={notes}
            onDeleted={(id) => {
              setNotes((prev) => prev.filter((n) => n._id !== id));
              bumpHealth();
            }}
            onUpdated={(updated) => {
              setNotes((prev) => prev.map((n) => (n._id === updated._id ? updated : n)));
              bumpHealth();
            }}
          />
        </div>
      )}

      {tab === "Files" && (
        <div className="space-y-4">
          <FileUpload
            projectId={projectId}
            onUploaded={(f) => {
              setFiles((prev) => [f, ...prev]);
              bumpHealth();
            }}
          />
          <FileList
            files={files}
            onDeleted={(id) => {
              setFiles((prev) => prev.filter((f) => f._id !== id));
              bumpHealth();
            }}
          />
        </div>
      )}

      {tab === "Tasks" && <TaskList projectId={projectId} />}

      {tab === "Search" && <SearchBar projectId={projectId} />}

      {tab === "Analytics" && <AnalyticsPanel projectId={projectId} />}

      {tab === "AI Reports" && (
        <ReportGenerator
          projectId={projectId}
          initialReadme={project.readme}
          onReadmeGenerated={(readme) => setProject((p) => ({ ...p, readme }))}
        />
      )}

      {tab === "Members" && (
        <MembersPanel project={project} currentUserId={user?._id} onUpdated={(p) => setProject(p)} />
      )}

      {tab === "Discussion" && <CommentsPanel projectId={projectId} />}
    </div>
  );
}
