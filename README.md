# CollabSphere 🚀

AI-powered developer collaboration platform — a mini GitHub + Notion, supercharged with **Groq AI** (Llama models). Built as a placement-ready full-stack capstone project.

## ✨ Features

### Core Platform
- **Authentication** — JWT + bcrypt, secure register/login
- **Projects & Collaboration** — create projects, invite members with roles (owner/editor/viewer)
- **Markdown Notes** — rich note-taking per project
- **File Upload & Preview** — code/asset uploads via Cloudinary, versioned by filename
- **Contribution Analytics** — per-member note/file counts, visualized with charts
- **Public Shareable Pages** — read-only public link for a project's README + notes
- **Real-time presence** — Socket.io wired for "who's online / editing" indicators

### AI Features (powered by Groq)
| Feature | What it does |
|---|---|
| 🧠 Explain Note / Explain Code | Plain-English explanation of notes or uploaded code |
| ✨ Improve Note | AI-suggested edits for clarity |
| 🏷️ Auto-Tagging | Every note gets AI-generated tags automatically |
| 🔍 AI Code Review | Diffs old vs new file version, flags risks like a PR reviewer |
| 📄 AI README Generator | Scans project files/notes → drafts a full README.md |
| 📊 Weekly Report Generator | Turns raw activity logs into a stakeholder-ready report |
| 🩺 Project Health Score | Classifies project as Healthy / Slowing / Inactive with reasoning |
| 🔎 AI Semantic Search | Natural-language search across notes & files (not just keyword match) |
| ✅ AI Task Extraction | Pulls action items out of meeting notes into a task board |
| 🔁 Duplicate Note Detector | Warns when a new note looks like an existing one |

### 🤖 Bonus: Voice AI Assistant ("Sphere")
A ChatGPT-style floating assistant, built with the **Web Speech API**:
- **Speech-to-Text (STT)** — tap the mic, speak your question
- **Speech-to-Speech (STS)** — response is spoken back aloud *and* shown as text
- **Persistent memory** — remembers the user's name every session (via profile), plus can store extra facts (`/api/assistant/remember`)
- **Conversation history** — stored per-user in MongoDB, last 20 messages used as context
- Full loading states: `listening → thinking → speaking`
- Graceful error handling: mic permission denied, no speech detected, API timeout, network failure

## 🛠 Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React (Vite), Tailwind CSS, React Router, Recharts, Web Speech API |
| Backend | Node.js, Express.js |
| Database | MongoDB + Mongoose |
| AI | Groq API (`llama-3.3-70b-versatile` + `llama-3.1-8b-instant`) |
| File Storage | Cloudinary |
| Real-time | Socket.io |
| Auth | JWT + bcrypt |

## 📁 Project Structure

```
collabsphere/
├── backend/
│   ├── config/          # db.js, cloudinary.js
│   ├── models/          # User, Project, Note, FileItem, Conversation, Task
│   ├── middleware/       # auth, project loader, upload, error handler
│   ├── services/         # groqService.js (all AI calls), uploadService.js
│   ├── controllers/      # auth, project, note, file, ai, assistant
│   ├── routes/
│   └── server.js
└── frontend/
    └── src/
        ├── api/axios.js
        ├── context/AuthContext.jsx
        ├── pages/         # Login, Register, Dashboard, ProjectPage, PublicProject
        └── components/    # NoteEditor, FileUpload, VoiceAssistant, AnalyticsPanel, etc.
```

## ⚙️ Setup Instructions

### Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster (or local MongoDB)
- A free [Groq API key](https://console.groq.com)
- A free [Cloudinary](https://cloudinary.com) account

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# Fill in MONGO_URI, JWT_SECRET, GROQ_API_KEY, CLOUDINARY_* in .env
npm run dev
```

Backend runs on `http://localhost:5000`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env
# VITE_API_URL=http://localhost:5000/api (default is fine for local dev)
npm run dev
```

Frontend runs on `http://localhost:5173`.

### 3. Try it out
1. Register a new account
2. Create a project
3. Add a markdown note → watch AI auto-tag it
4. Upload a `.js` or `.py` file → click "Explain Code" or "AI Code Review"
5. Click the 🤖 floating button → talk to Sphere with your mic
6. Check the "AI Reports" tab for weekly report + README generation
7. Try "Search" tab with a natural-language query

## 🔑 Environment Variables

See `backend/.env.example` and `frontend/.env.example` for the full list. Never commit real `.env` files — they're already in `.gitignore`.

## 🚀 Deployment

- **Backend** → Render / Railway / AWS EC2
- **Frontend** → Vercel / Netlify
- **Database** → MongoDB Atlas
- Remember to update `CLIENT_URL` (backend) and `VITE_API_URL` (frontend) for production.

## 📌 Notes on AI Architecture

All Groq calls are centralized in `backend/services/groqService.js` — every AI feature (explain, review, README gen, search, task extraction, assistant chat) is a thin wrapper around one `chatCompletion()` function. This keeps the code DRY, makes it trivial to swap models, and is a good talking point in interviews: *"I built one reusable AI service layer that every feature routes through, with JSON-mode structured outputs for anything that needs parsing."*

## 🔮 Future Scope (great for a README "roadmap" section)
- Vector embeddings + MongoDB Atlas Vector Search for true semantic search at scale
- GitHub OAuth import for real repos
- Slack/Discord notifications on AI-flagged risks in code review
- Team-level (not just project-level) health dashboards

---

Built as a full-stack + AI capstone project to demonstrate frontend, backend, database, and AI integration skills end-to-end.
