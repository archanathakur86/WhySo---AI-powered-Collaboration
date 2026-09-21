import React, { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import Markdown from "./Markdown.jsx";

// Keep in sync with TEXT_EXTENSIONS in backend/services/uploadService.js (minus plain .txt)
const CODE_EXTENSIONS = [
  "js", "jsx", "ts", "tsx", "py", "java", "c", "cpp", "h", "cs", "go", "rs", "rb", "php",
  "sh", "sql", "yml", "yaml", "vue", "md", "json", "html", "css",
];
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
// The browser can display these in a new tab; any other type is downloaded instead
const VIEWABLE_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt", ...CODE_EXTENSIONS];

const RISK_STYLES = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-green-100 text-green-700 border-green-200",
};

// With responseType "blob", error bodies arrive as a Blob too, so unwrap the JSON message
const readErrorMessage = async (err, fallback) => {
  const data = err.response?.data;
  if (data instanceof Blob) {
    try {
      return JSON.parse(await data.text()).message || fallback;
    } catch {
      return fallback;
    }
  }
  return data?.message || fallback;
};

function RiskPill({ level, children }) {
  return (
    <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-full border ${RISK_STYLES[level] || RISK_STYLES.medium}`}>
      {children || level}
    </span>
  );
}

function ReviewPanel({ file, review, reviewing, onRerun }) {
  if (!review) {
    return (
      <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-3 text-sm text-slate-500">
        {file.version > 1 ? `AI is comparing v${file.version} with the previous version...` : "AI is reviewing this file..."}
      </div>
    );
  }

  const compared = review.comparedWithVersion;
  return (
    <div className={`mt-3 bg-brand-50 border border-brand-100 rounded-lg p-4 text-sm ${reviewing ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-brand-700">🔍 AI Code Review</p>
          <p className="text-xs text-slate-500">
            {compared
              ? `v${file.version} compared with v${compared} · +${review.addedLines} −${review.removedLines} lines`
              : `v${file.version} · first version, so the whole file was reviewed`}
          </p>
        </div>
        <RiskPill level={review.riskLevel}>Risk: {review.riskLevel}</RiskPill>
      </div>

      <p className="font-medium text-slate-800 mb-1">Summary</p>
      <p className="text-slate-700 mb-3 leading-relaxed">{review.summary}</p>

      <p className="font-medium text-slate-800 mb-1">Risks</p>
      {review.risks.length === 0 ? (
        <p className="text-slate-500 mb-3">No significant risks found ✓</p>
      ) : (
        <ul className="space-y-1.5 mb-3">
          {review.risks.map((r, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">
                <RiskPill level={r.severity} />
              </span>
              <span className="text-slate-700 leading-relaxed">{r.description}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="font-medium text-slate-800 mb-1">Suggestions</p>
      {review.suggestions.length === 0 ? (
        <p className="text-slate-500 mb-3">Nothing to add.</p>
      ) : (
        <ul className="list-disc pl-5 space-y-1 text-slate-700 mb-3">
          {review.suggestions.map((s, i) => (
            <li key={i} className="leading-relaxed">
              {s}
            </li>
          ))}
        </ul>
      )}

      {review.truncated && (
        <p className="text-xs text-amber-600 mb-2">
          This file/diff was very long, so only the first part could be reviewed.
        </p>
      )}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{review.generatedAt ? `Reviewed ${new Date(review.generatedAt).toLocaleString()}` : ""}</span>
        <button className="text-brand-600 hover:underline disabled:opacity-50" onClick={onRerun} disabled={reviewing}>
          {reviewing ? "Re-running..." : "↻ Re-run review"}
        </button>
      </div>
    </div>
  );
}

function FileCard({ file, onDeleted }) {
  const [explanation, setExplanation] = useState(null);
  const [explaining, setExplaining] = useState(false);
  const [review, setReview] = useState(file.review || null);
  const [showReview, setShowReview] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [opening, setOpening] = useState(false);
  const autoReviewStarted = useRef(false);

  const isCode = !!file.fileType && CODE_EXTENSIONS.includes(file.fileType);
  const isImage = IMAGE_EXTENSIONS.includes(file.fileType);

  const runExplain = async () => {
    setExplaining(true);
    try {
      const res = await api.post(`/files/${file._id}/explain`);
      setExplanation(res.data.explanation);
    } catch (err) {
      toast.error(err.response?.data?.message || "AI action failed");
    } finally {
      setExplaining(false);
    }
  };

  const runReview = async ({ regenerate = false } = {}) => {
    setShowReview(true);
    setReviewing(true);
    try {
      const res = await api.post(`/files/${file._id}/review`, { regenerate });
      setReview(res.data.review);
    } catch (err) {
      toast.error(err.response?.data?.message || "AI review failed");
      if (!review) setShowReview(false); // nothing to show; a failed re-run keeps the old review visible
    } finally {
      setReviewing(false);
    }
  };

  // Uploading a new version of a code file kicks off the AI review straight away.
  // The ref guard keeps React StrictMode's double-mount from firing it twice in dev.
  useEffect(() => {
    if (file._justUploaded && file.version > 1 && isCode && !review && !autoReviewStarted.current) {
      autoReviewStarted.current = true;
      runReview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReviewClick = () => {
    if (review) setShowReview((s) => !s);
    else runReview();
  };

  // Files are fetched through our API (not the raw Cloudinary URL), so PDFs still open
  // when Cloudinary blocks public PDF delivery, and only project members can read them.
  const openFile = async () => {
    if (opening) return;
    const viewable = VIEWABLE_EXTENSIONS.includes(file.fileType);
    // The tab must be opened inside the click handler, before the await, or popup blockers stop it
    const tab = viewable ? window.open("", "_blank") : null;
    setOpening(true);
    try {
      const res = await api.get(`/files/${file._id}/download`, { responseType: "blob" });
      const blobUrl = URL.createObjectURL(res.data);
      if (tab) {
        tab.location.href = blobUrl;
      } else {
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = file.originalName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (err) {
      tab?.close();
      toast.error(await readErrorMessage(err, "Couldn't open this file"));
    } finally {
      setOpening(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete ${file.originalName}?`)) return;
    try {
      await api.delete(`/files/${file._id}`);
      toast.success("File deleted");
      onDeleted(file._id);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete file");
    }
  };

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <button
            type="button"
            onClick={openFile}
            disabled={opening}
            className="font-medium text-brand-700 hover:underline text-left disabled:opacity-60"
            title={VIEWABLE_EXTENSIONS.includes(file.fileType) ? "Open in a new tab" : "Download"}
          >
            {opening ? "Opening..." : file.originalName}
          </button>
          <p className="text-xs text-slate-400">
            v{file.version} · {file.uploader?.name} · {new Date(file.createdAt).toLocaleDateString()}
          </p>
        </div>
        <button onClick={handleDelete} className="text-xs text-red-500 hover:underline">
          Delete
        </button>
      </div>

      {isImage && <img src={file.url} alt={file.originalName} className="mt-2 max-h-40 rounded-lg border" />}

      {isCode && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button className="btn btn-secondary text-xs py-1" disabled={explaining} onClick={runExplain}>
            {explaining ? "Explaining..." : "🧠 Explain Code"}
          </button>
          <button className="btn btn-secondary text-xs py-1" disabled={reviewing && !review} onClick={handleReviewClick}>
            {reviewing && !review
              ? "Reviewing..."
              : review
              ? showReview
                ? "🔍 Hide AI Review"
                : "🔍 View AI Review"
              : "🔍 AI Code Review"}
          </button>
        </div>
      )}

      {showReview && <ReviewPanel file={file} review={review} reviewing={reviewing} onRerun={() => runReview({ regenerate: true })} />}

      {explanation && (
        <div className="mt-3 bg-brand-50 border border-brand-100 rounded-lg p-3">
          <p className="font-medium text-brand-700 mb-1 text-sm">Code Explanation</p>
          <Markdown>{explanation}</Markdown>
        </div>
      )}
    </div>
  );
}

export default function FileList({ files, onDeleted }) {
  if (files.length === 0) {
    return <div className="card text-center py-8 text-slate-500">No files uploaded yet.</div>;
  }
  return (
    <div className="space-y-3">
      {files.map((f) => (
        <FileCard key={f._id} file={f} onDeleted={onDeleted} />
      ))}
    </div>
  );
}