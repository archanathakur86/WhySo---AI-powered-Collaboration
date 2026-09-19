import React, { useEffect, useState, useCallback } from "react";
import api from "../api/axios.js";

const STATUS_STYLES = {
  healthy: "bg-green-100 text-green-700 border-green-200",
  slowing: "bg-yellow-100 text-yellow-700 border-yellow-200",
  inactive: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_EMOJI = { healthy: "🟢", slowing: "🟡", inactive: "🔴" };

// refreshKey: bump this number from the parent whenever a note/file/task is
// created or deleted so the badge updates immediately, without needing a
// full page reload. It also polls every 2 minutes as a safety net.
export default function HealthBadge({ projectId, refreshKey }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await api.get(`/projects/${projectId}/ai/health`);
      setHealth(res.data);
      setErrored(false);
    } catch (err) {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchHealth();
  }, [fetchHealth, refreshKey]);

  useEffect(() => {
    const interval = setInterval(fetchHealth, 120000); // refresh every 2 min as a safety net
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading && !health) {
    return (
      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm bg-slate-50 text-slate-400 border-slate-200">
        <span className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" /> Checking health...
      </span>
    );
  }

  if (errored || !health) {
    return (
      <button
        onClick={fetchHealth}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600"
      >
        ⚠️ Health unavailable — retry
      </button>
    );
  }

  const status = health.insight?.status || "healthy";

  return (
    <button
      onClick={fetchHealth}
      title="Click to refresh"
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-opacity hover:opacity-80 ${STATUS_STYLES[status]}`}
    >
      <span>{STATUS_EMOJI[status]}</span>
      <span className="font-medium capitalize">{status}</span>
      <span className="text-xs opacity-80 hidden sm:inline">— {health.insight?.reason}</span>
      {loading && <span className="text-xs opacity-60">↻</span>}
    </button>
  );
}
