import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import toast from "react-hot-toast";
import api from "../api/axios.js";

export default function ReportGenerator({ projectId, initialReadme, onReadmeGenerated }) {
  const [report, setReport] = useState(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);

  const [readme, setReadme] = useState(initialReadme || "");
  const [readmeGeneratedOnce, setReadmeGeneratedOnce] = useState(!!initialReadme);
  const [loadingReadme, setLoadingReadme] = useState(false);
  const [editingReadme, setEditingReadme] = useState(false);
  const [savingReadme, setSavingReadme] = useState(false);

  const generateReport = async () => {
    setLoadingReport(true);
    try {
      const res = await api.get(`/projects/${projectId}/ai/weekly-report`);
      setReport(res.data.report);
      setReportGenerated(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate report");
    } finally {
      setLoadingReport(false);
    }
  };

  const generateReadme = async () => {
    setLoadingReadme(true);
    try {
      const res = await api.post(`/projects/${projectId}/ai/readme`);
      setReadme(res.data.readme);
      setReadmeGeneratedOnce(true);
      toast.success("README generated and saved to project");
      onReadmeGenerated?.(res.data.readme);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to generate README");
    } finally {
      setLoadingReadme(false);
    }
  };

  const saveReadmeEdit = async () => {
    setSavingReadme(true);
    try {
      await api.patch(`/projects/${projectId}`, { readme });
      toast.success("README updated");
      onReadmeGenerated?.(readme);
      setEditingReadme(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save README");
    } finally {
      setSavingReadme(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">Weekly Progress Report</h4>
            <p className="text-sm text-slate-500">AI summarizes this week's activity into a stakeholder-ready update.</p>
          </div>
          <button
            className="btn btn-primary text-sm whitespace-nowrap"
            onClick={generateReport}
            disabled={loadingReport || reportGenerated}
          >
            {loadingReport ? "Generating..." : reportGenerated ? "Generated ✓" : "Generate"}
          </button>
        </div>
        {reportGenerated && (
          <button className="text-xs text-brand-600 hover:underline mt-2" onClick={() => setReportGenerated(false)}>
            Generate again
          </button>
        )}
        {report && (
          <div className="mt-4 prose prose-sm max-w-none bg-brand-50 border border-brand-100 rounded-lg p-4">
            <ReactMarkdown>{report}</ReactMarkdown>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-semibold">AI README Generator</h4>
            <p className="text-sm text-slate-500">Scans your project's files and notes to draft a professional README.</p>
          </div>
          <button
            className="btn btn-primary text-sm whitespace-nowrap"
            onClick={generateReadme}
            disabled={loadingReadme || readmeGeneratedOnce}
          >
            {loadingReadme ? "Writing..." : readmeGeneratedOnce ? "Generated ✓" : "Generate README"}
          </button>
        </div>
        {readmeGeneratedOnce && (
          <button className="text-xs text-brand-600 hover:underline mt-2" onClick={() => setReadmeGeneratedOnce(false)}>
            Regenerate from scratch
          </button>
        )}

        {readme && !editingReadme && (
          <>
            <div className="mt-4 prose prose-sm max-w-none bg-brand-50 border border-brand-100 rounded-lg p-4 max-h-96 overflow-y-auto">
              <ReactMarkdown>{readme}</ReactMarkdown>
            </div>
            <button className="btn btn-secondary text-sm mt-3" onClick={() => setEditingReadme(true)}>
              ✏️ Edit README
            </button>
          </>
        )}

        {readme && editingReadme && (
          <div className="mt-4 space-y-2">
            <textarea
              className="input font-mono text-sm"
              rows={14}
              value={readme}
              onChange={(e) => setReadme(e.target.value)}
            />
            <div className="flex gap-2">
              <button className="btn btn-primary text-sm" onClick={saveReadmeEdit} disabled={savingReadme}>
                {savingReadme ? "Saving..." : "Save Changes"}
              </button>
              <button className="btn btn-secondary text-sm" onClick={() => setEditingReadme(false)} disabled={savingReadme}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
