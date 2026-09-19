import React from "react";

export default function EyeIcon({ open, className = "w-5 h-5" }) {
  if (open) {
    // open eye
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
        <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  // eye with a slash through it (banned/hidden), not a crossed-out eyeball emoji
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path
        d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M6.6 6.7C4 8.3 1.5 12 1.5 12s3.5 7 10.5 7c1.7 0 3.2-.4 4.5-1.1M9.9 5.2A10.6 10.6 0 0 1 12 5c7 0 10.5 7 10.5 7-.4.8-1.1 1.9-2.1 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}