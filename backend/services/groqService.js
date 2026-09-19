import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const MODEL_FAST = process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant";

/**
 * Generic chat completion wrapper with error handling + timeout safety.
 * @param {Array} messages - [{role, content}]
 * @param {Object} opts - { model, temperature, maxTokens, jsonMode }
 */
export const chatCompletion = async (messages, opts = {}) => {
  const { model = MODEL, temperature = 0.4, maxTokens = 1024, jsonMode = false } = opts;

  try {
    const response = await groq.chat.completions.create({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: jsonMode ? { type: "json_object" } : undefined,
    });
    return response.choices[0]?.message?.content?.trim() || "";
  } catch (err) {
    console.error("Groq API error:", err.message);
    throw new Error("AI service is currently unavailable. Please try again shortly.");
  }
};

/** Fast, low-latency completion - used for voice assistant to keep STS snappy */
export const fastCompletion = async (messages, opts = {}) => {
  return chatCompletion(messages, { ...opts, model: MODEL_FAST });
};

// ---------- Feature-specific prompt builders ----------

export const explainText = async (content, kind = "note") => {
  const messages = [
    {
      role: "system",
      content:
      "You are a precise technical writing assistant embedded in a developer collaboration tool called WhySo. Explain content clearly and concisely for developers. Use short paragraphs or bullet points. Do not pad with fluff.",
    },
    {
      role: "user",
      content: `Explain the following ${kind} in simple, clear terms:\n\n${content}`,
    },
  ];
  return chatCompletion(messages, { maxTokens: 600 });
};

export const suggestImprovements = async (content) => {
  const messages = [
    {
      role: "system",
      content:
        "You are an expert technical editor. Suggest concrete, actionable improvements to the given markdown note. Return a short bullet list only, no preamble.",
    },
    { role: "user", content },
  ];
  return chatCompletion(messages, { maxTokens: 500 });
};

export const explainCode = async (code, filename = "") => {
  const messages = [
    {
      role: "system",
      content:
        "You are a senior software engineer. Explain what the given code does, its structure, and flag any obvious issues. Be concise and use bullet points where helpful.",
    },
    { role: "user", content: `File: ${filename}\n\n${code}` },
  ];
  return chatCompletion(messages, { maxTokens: 700 });
};

export const reviewCodeDiff = async (oldCode, newCode, filename = "") => {
  const messages = [
    {
      role: "system",
      content:
        "You are a senior code reviewer, similar to a GitHub PR reviewer. Given the old and new version of a file, summarize what changed, flag potential risks or bugs introduced, and suggest improvements. Be specific and concise. Format as: '### Summary', '### Risks', '### Suggestions'.",
    },
    {
      role: "user",
      content: `File: ${filename}\n\n--- OLD VERSION ---\n${oldCode || "(no previous version)"}\n\n--- NEW VERSION ---\n${newCode}`,
    },
  ];
  return chatCompletion(messages, { maxTokens: 800 });
};

export const generateReadme = async (projectName, description, fileSummaries = [], noteSummaries = []) => {
  const messages = [
    {
      role: "system",
      content:
        "You are an expert technical writer. Generate a clean, professional README.md in Markdown for the given project, based on its description, files, and notes. Include sections: Overview, Features, Tech Stack (infer from file types if possible), and Getting Started (generic placeholders if unknown). Return ONLY markdown, no commentary.",
    },
    {
      role: "user",
      content: `Project name: ${projectName}\nDescription: ${description}\n\nFiles in project:\n${fileSummaries.join(
        "\n"
      )}\n\nKey notes:\n${noteSummaries.join("\n")}`,
    },
  ];
  return chatCompletion(messages, { maxTokens: 1200 });
};

export const generateTags = async (content) => {
  const messages = [
    {
      role: "system",
      content:
        'Return 3-6 short lowercase tags (single words or short phrases) that best categorize this note. Respond ONLY as JSON: {"tags": ["tag1", "tag2"]}',
    },
    { role: "user", content },
  ];
  const raw = await chatCompletion(messages, { maxTokens: 150, jsonMode: true, temperature: 0.2 });
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.tags) ? parsed.tags.slice(0, 6) : [];
  } catch {
    return [];
  }
};

export const extractActionItems = async (noteContent) => {
  const messages = [
    {
      role: "system",
      content:
        'Extract concrete action items / tasks from this note. Respond ONLY as JSON: {"tasks": [{"title": "...", "assigneeGuess": "name or empty string", "priority": "low|medium|high"}]}. If no clear tasks exist, return {"tasks": []}.',
    },
    { role: "user", content: noteContent },
  ];
  const raw = await chatCompletion(messages, { maxTokens: 500, jsonMode: true, temperature: 0.2 });
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.tasks) ? parsed.tasks : [];
  } catch {
    return [];
  }
};

export const generateWeeklyReport = async (projectName, activityLogText) => {
  const messages = [
    {
      role: "system",
      content:
        "You are a project manager assistant. Turn raw activity logs into a concise, stakeholder-ready weekly progress report in Markdown. Group by contributor. Mention what was worked on and overall momentum. Keep it under 300 words.",
    },
    { role: "user", content: `Project: ${projectName}\n\nActivity log:\n${activityLogText}` },
  ];
  return chatCompletion(messages, { maxTokens: 600 });
};

export const computeHealthInsight = async (stats) => {
  const messages = [
    {
      role: "system",
      content:
        'Given project activity stats (JSON), classify project health as one of "healthy", "slowing", "inactive". Give a very short reason, under 12 words, plain and specific (e.g. "3 updates this week, last one yesterday"). Respond ONLY as JSON: {"status": "healthy|slowing|inactive", "reason": "..."}',
    },
    { role: "user", content: JSON.stringify(stats) },
  ];
  const raw = await chatCompletion(messages, { maxTokens: 150, jsonMode: true, temperature: 0.2 });
  try {
    return JSON.parse(raw);
  } catch {
    return { status: "healthy", reason: "Unable to compute insight." };
  }
};

export const checkDuplicateNote = async (newContent, existingNotesSummaries) => {
  if (!existingNotesSummaries.length) return { isDuplicate: false };
  const messages = [
    {
      role: "system",
      content:
        'Given a new note and a list of existing notes (id + short summary), determine if the new note is a likely duplicate/highly similar to any existing one. Respond ONLY as JSON: {"isDuplicate": true|false, "similarNoteId": "id or empty", "reason": "short reason"}',
    },
    {
      role: "user",
      content: `NEW NOTE:\n${newContent}\n\nEXISTING NOTES:\n${existingNotesSummaries
        .map((n) => `[${n.id}] ${n.summary}`)
        .join("\n")}`,
    },
  ];
  const raw = await chatCompletion(messages, { maxTokens: 200, jsonMode: true, temperature: 0.1 });
  try {
    return JSON.parse(raw);
  } catch {
    return { isDuplicate: false };
  }
};

export const semanticSearchAnswer = async (query, candidates) => {
  // candidates: [{id, type, title, snippet}]
  const messages = [
    {
      role: "system",
      content:
        'You are a search relevance engine for a developer collaboration tool. Given a user query and candidate notes/files, return the most relevant items ranked by relevance. Respond ONLY as JSON: {"results": [{"id": "...", "reason": "short reason it matches"}]}. Only include genuinely relevant items, max 8.',
    },
    {
      role: "user",
      content: `Query: "${query}"\n\nCandidates:\n${candidates
        .map((c) => `[${c.id}] (${c.type}) ${c.title}: ${c.snippet}`)
        .join("\n")}`,
    },
  ];
  const raw = await chatCompletion(messages, { maxTokens: 500, jsonMode: true, temperature: 0.2 });
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    return [];
  }
};

export default groq;
