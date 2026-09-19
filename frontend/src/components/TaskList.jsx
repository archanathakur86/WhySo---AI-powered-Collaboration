import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";

const PRIORITY_COLORS = {
  high: "bg-red-100 text-red-700",
  medium: "bg-yellow-100 text-yellow-700",
  low: "bg-slate-100 text-slate-600",
};

export default function TaskList({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

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
  }, [projectId]);

  const cycleStatus = async (task) => {
    const order = ["todo", "in-progress", "done"];
    const next = order[(order.indexOf(task.status) + 1) % order.length];
    try {
      const res = await api.patch(`/tasks/${task._id}`, { status: next });
      setTasks((prev) => prev.map((t) => (t._id === task._id ? res.data.task : t)));
    } catch (err) {
      toast.error("Failed to update task");
    }
  };

  const deleteTask = async (id) => {
    try {
      await api.delete(`/tasks/${id}`);
      setTasks((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      toast.error("Failed to delete task");
    }
  };

  if (loading) return <p className="text-slate-500">Loading tasks...</p>;
  if (tasks.length === 0)
    return (
      <div className="card text-center py-8 text-slate-500">
        No tasks yet. Use "Extract Tasks" on any note to auto-generate action items.
      </div>
    );

  return (
    <div className="space-y-2">
      {tasks.map((t) => (
        <div key={t._id} className="card flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => cycleStatus(t)}
              className={`text-xs px-2 py-1 rounded-full border ${
                t.status === "done"
                  ? "bg-green-100 text-green-700 border-green-200"
                  : t.status === "in-progress"
                  ? "bg-blue-100 text-blue-700 border-blue-200"
                  : "bg-slate-100 text-slate-600 border-slate-200"
              }`}
            >
              {t.status}
            </button>
            <div>
              <p className={`font-medium ${t.status === "done" ? "line-through text-slate-400" : ""}`}>{t.title}</p>
              {t.assigneeGuess && <p className="text-xs text-slate-400">Suggested: {t.assigneeGuess}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority]}`}>{t.priority}</span>
            <button onClick={() => deleteTask(t._id)} className="text-xs text-red-500 hover:underline">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
