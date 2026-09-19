import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import api from "../api/axios.js";

export default function PublicProject() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/public/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.message || "Project not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="max-w-3xl mx-auto px-4 py-10 text-slate-500">Loading...</div>;
  if (error)
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center">
        <p className="text-red-500">{error}</p>
      </div>
    );

  const { project, notes } = data;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-brand-600 font-semibold">Public Project</div>
      <h1 className="text-3xl font-bold">{project.name}</h1>
      <p className="text-slate-500 mt-1">{project.description}</p>
      <p className="text-xs text-slate-400 mt-2">
        Shared by {project.owner?.name} · {new Date(project.createdAt).toLocaleDateString()}
      </p>

      {project.readme && (
        <div className="card mt-6 prose max-w-none">
          <ReactMarkdown>{project.readme}</ReactMarkdown>
        </div>
      )}

      <h2 className="text-xl font-semibold mt-8 mb-3">Notes</h2>
      {notes.length === 0 ? (
        <p className="text-slate-400 text-sm">No public notes.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n._id} className="card">
              <h3 className="font-semibold">{n.title}</h3>
              <div className="prose prose-sm max-w-none mt-2">
                <ReactMarkdown>{n.content}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-slate-400 mt-10">
        Powered by <span className="font-semibold text-brand-600">WhySo</span>
      </p>
    </div>
  );
}
