import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";

const STATUS_OPTIONS = [
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "done", label: "Done" },
];

const PRIORITY_OPTIONS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
];

const STATUS_STYLES = {
  todo: "bg-slate-100 text-slate-700 border-slate-300",
  "in-progress": "bg-blue-100 text-blue-700 border-blue-200",
  done: "bg-green-100 text-green-700 border-green-200",
};

const PRIORITY_STYLES = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-slate-100 text-slate-600 border-slate-300",
};

const FILTERS = [{ value: "all", label: "All" }, ...STATUS_OPTIONS];

const selectClass = (styles) =>
  `text-xs font-medium rounded-full border px-2.5 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-wait ${styles}`;

export default function TaskList({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [savingIds, setSavingIds] = useState(() => new Set());

  const loadTasks = async () => {
    try {
      const res = await api.get(`/projects/${projectId}/tasks`);
      setTasks(res.data.tasks);
    } catch (err) {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const setSaving = (id, isSaving) =>
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (isSaving) next.add(id);
      else next.delete(id);
      return next;
    });

  // Updates the UI immediately, then confirms with the server; rolls back on failure.
  // The row's dropdowns are disabled while a save is in flight, so edits can't overlap.
  const updateTask = async (task, changes) => {
    setTasks((prev) => prev.map((t) => (t._id === task._id ? { ...t, ...changes } : t)));
    setSaving(task._id, true);
    try {
      const res = await api.patch(`/tasks/${task._id}`, changes);
      setTasks((prev) => prev.map((t) => (t._id === task._id ? res.data.task : t)));
    } catch (err) {
      setTasks((prev) => prev.map((t) => (t._id === task._id ? task : t)));
      toast.error(err.response?.data?.message || "Failed to update task");
    } finally {
      setSaving(task._id, false);
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete task");
    }
  };

  if (loading) return <p className="text-slate-500">Loading tasks...</p>;
  if (tasks.length === 0)
    return (
      <div className="card text-center py-8 text-slate-500">
        No tasks yet. Use "Extract Tasks" on any note to auto-generate action items.
      </div>
    );

  const countOf = (value) => (value === "all" ? tasks.length : tasks.filter((t) => t.status === value).length);
  const doneCount = countOf("done");
  const percentDone = Math.round((doneCount / tasks.length) * 100);
  const visible = filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div className="space-y-3">
      <div className="card py-3">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="font-medium">
            {doneCount} of {tasks.length} tasks done
          </span>
          <span className="text-slate-400">{percentDone}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 transition-all" style={{ width: `${percentDone}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              filter === f.value
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-slate-600 border-slate-300 hover:bg-slate-100"
            }`}
          >
            {f.label} ({countOf(f.value)})
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="card text-center py-6 text-slate-500 text-sm">No tasks in this status.</div>
      )}

      <div className="space-y-2">
        {visible.map((t) => {
          const saving = savingIds.has(t._id);
          return (
            <div key={t._id} className="card py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <p className={`font-medium ${t.status === "done" ? "line-through text-slate-400" : ""}`}>{t.title}</p>
                {t.assigneeGuess && <p className="text-xs text-slate-400">Suggested: {t.assigneeGuess}</p>}
              </div>

              <div className="flex items-end gap-3 flex-shrink-0">
                <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  Status
                  <select
                    value={t.status}
                    disabled={saving}
                    onChange={(e) => updateTask(t, { status: e.target.value })}
                    className={selectClass(STATUS_STYLES[t.status])}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                  Urgency
                  <select
                    value={t.priority}
                    disabled={saving}
                    onChange={(e) => updateTask(t, { priority: e.target.value })}
                    className={selectClass(PRIORITY_STYLES[t.priority])}
                  >
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={() => deleteTask(t._id)}
                  className="text-xs text-red-500 hover:underline pb-1.5"
                  aria-label={`Delete task: ${t.title}`}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}