import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import toast from "react-hot-toast";
import api from "../api/axios.js";

export default function AnalyticsPanel({ projectId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get(`/projects/${projectId}/analytics`)
      .then((res) => setData(res.data))
      .catch(() => toast.error("Failed to load analytics"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-slate-500">Loading analytics...</p>;
  if (!data) return null;

  const chartData = data.contribution.map((c) => ({
    name: c.user.name.split(" ")[0],
    Notes: c.notes,
    Files: c.files,
  }));

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="card">
          <p className="text-sm text-slate-500">Total Notes</p>
          <p className="text-3xl font-bold text-brand-700">{data.totals.notes}</p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total Files</p>
          <p className="text-3xl font-bold text-brand-700">{data.totals.files}</p>
        </div>
      </div>

      <div className="card">
        <h4 className="font-semibold mb-3">Contribution by Member</h4>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Legend />
            <Bar dataKey="Notes" fill="#4f6df5" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Files" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h4 className="font-semibold mb-3">Recent Activity</h4>
        {data.recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400">No recent activity</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data.recentActivity.map((a, i) => (
              <li key={i} className="text-slate-600 border-b border-slate-100 pb-1 last:border-0">
                <span className="font-medium">{a.action?.replace(/_/g, " ")}</span>
                {a.detail ? ` — ${a.detail}` : ""}
                <span className="text-xs text-slate-400 ml-2">{new Date(a.createdAt).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
