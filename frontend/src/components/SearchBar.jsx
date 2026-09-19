import React, { useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";

export default function SearchBar({ projectId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim() || query.trim().length < 2) {
      toast.error("Type at least 2 characters");
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.get(`/projects/${projectId}/ai/search`, { params: { q: query } });
      setResults(res.data.results);
    } catch (err) {
      toast.error(err.response?.data?.message || "Search failed");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          className="input"
          placeholder="Ask in plain English e.g. 'where did we discuss auth retry logic'"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary whitespace-nowrap" disabled={loading}>
          {loading ? "Searching..." : "🔎 AI Search"}
        </button>
      </form>

      {searched && !loading && (
        <div className="space-y-2">
          {results?.length === 0 ? (
            <p className="text-slate-500 text-sm">No relevant results found.</p>
          ) : (
            results?.map((r) => (
              <div key={r.id} className="card">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full uppercase text-slate-500">{r.type}</span>
                  <h4 className="font-medium">{r.title}</h4>
                </div>
                <p className="text-sm text-slate-500 mt-1">{r.snippet}...</p>
                <p className="text-xs text-brand-600 mt-2 italic">Why it matches: {r.reason}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
