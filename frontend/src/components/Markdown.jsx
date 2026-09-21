import React from "react";
import ReactMarkdown from "react-markdown";

// The project doesn't use @tailwindcss/typography, so `prose` classes do nothing
// and Tailwind's reset leaves headings/lists looking like plain text. This
// renders AI markdown (reports, README, code reviews) with proper styling.
const components = {
  h1: ({ children }) => <h3 className="text-lg font-bold text-slate-800 mt-4 mb-2 first:mt-0">{children}</h3>,
  h2: ({ children }) => <h4 className="text-base font-semibold text-slate-800 mt-4 mb-1.5 first:mt-0">{children}</h4>,
  h3: ({ children }) => <h5 className="text-sm font-semibold text-slate-800 mt-3 mb-1 first:mt-0">{children}</h5>,
  h4: ({ children }) => <h6 className="text-sm font-medium text-slate-700 mt-3 mb-1 first:mt-0">{children}</h6>,
  p: ({ children }) => <p className="mb-2 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-brand-600 underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-slate-300 pl-3 my-2 text-slate-500">{children}</blockquote>
  ),
  hr: () => <hr className="my-3 border-slate-200" />,
  pre: ({ children }) => (
    <pre className="bg-slate-800 text-slate-100 rounded-lg p-3 my-2 overflow-x-auto text-xs">{children}</pre>
  ),
  code: ({ className, children }) => {
    const isBlock = /language-/.test(className || "") || String(children).includes("\n");
    return isBlock ? (
      <code className="font-mono">{children}</code>
    ) : (
      <code className="bg-slate-200/70 rounded px-1 py-0.5 text-[0.85em] font-mono">{children}</code>
    );
  },
};

export default function Markdown({ children, className = "" }) {
  return (
    <div className={`text-sm text-slate-700 ${className}`}>
      <ReactMarkdown components={components}>{String(children || "")}</ReactMarkdown>
    </div>
  );
}