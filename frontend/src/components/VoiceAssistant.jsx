import React, { useState, useRef, useEffect } from "react";
import { useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Extracts a project id from URLs like /projects/64f1... — returns null on
// any other page (dashboard etc), so the assistant falls back to a "general"
// conversation there.
const useCurrentProjectId = () => {
  const location = useLocation();
  const match = location.pathname.match(/^\/projects\/([a-fA-F0-9]{24})/);
  return match ? match[1] : null;
};

export default function VoiceAssistant() {
  const { user } = useAuth();
  const projectId = useCurrentProjectId();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [micSupported] = useState(!!SpeechRecognition);
  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  // Reload the right conversation whenever the panel opens OR the user
  // switches to a different project — each project keeps its own history.
  useEffect(() => {
    if (!open) return;
    api
      .get("/assistant/history", { params: projectId ? { projectId } : {} })
      .then((res) => {
        const hist = res.data.messages.map((m) => ({ role: m.role, content: m.content }));
        setMessages(hist);
      })
      .catch(() => setMessages([]));
  }, [open, projectId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const speak = (text) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setStatus("speaking");
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("idle");
    synthRef.current.speak(utterance);
  };

  const sendMessage = async (message) => {
    if (!message.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setStatus("thinking");
    try {
      const res = await api.post("/assistant/chat", { message, projectId: projectId || undefined });
      setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
      speak(res.data.reply);
    } catch (err) {
      const errMsg = err.response?.data?.message || "Sorry, I couldn't process that. Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
      setStatus("idle");
      toast.error(errMsg);
    }
  };

  const handleTextSend = (e) => {
    e.preventDefault();
    const msg = textInput;
    setTextInput("");
    sendMessage(msg);
  };

  const startListening = () => {
    if (!micSupported) {
      toast.error("Voice input isn't supported in this browser. Try Chrome.");
      return;
    }
    if (status === "listening") {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onerror = (event) => {
      setStatus("idle");
      if (event.error === "not-allowed") {
        toast.error("Microphone permission denied. Please allow mic access.");
      } else if (event.error === "no-speech") {
        toast.error("No speech detected. Try again.");
      } else {
        toast.error("Voice recognition error. Please try again.");
      }
    };
    recognition.onend = () => {
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      toast.error("Could not start microphone. Please try again.");
    }
  };

  const clearHistory = async () => {
    try {
      await api.delete("/assistant/history", { params: projectId ? { projectId } : {} });
      setMessages([]);
      toast.success("Conversation cleared");
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const statusLabel = {
    idle: "Tap mic or type to talk to Sphere",
    listening: "🎙️ Listening...",
    thinking: "💭 Thinking...",
    speaking: "🔊 Speaking...",
  };

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center text-2xl hover:bg-brand-700 z-30"
        aria-label="Open AI assistant"
      >
        {open ? "✕" : "🤖"}
      </button>

      {open && (
        <>
          {/* Dim backdrop only in expanded/fullscreen mode, click to shrink back down */}
          {expanded && (
            <div className="fixed inset-0 bg-slate-900/30 z-20" onClick={() => setExpanded(false)} aria-hidden="true" />
          )}

          <div
            className={`fixed bg-white shadow-2xl border border-slate-200 flex flex-col z-30 transition-all duration-200 ${
              expanded
                ? "inset-0 rounded-none"
                : "bottom-24 right-5 w-[90vw] max-w-sm h-[520px] rounded-2xl"
            }`}
          >
            <div
              className={`border-b border-slate-200 flex items-center justify-between flex-shrink-0 ${
                expanded ? "px-6 py-4 max-w-3xl w-full mx-auto" : "px-4 py-3"
              }`}
            >
              <div>
                <p className={`font-semibold text-brand-700 ${expanded ? "text-lg" : ""}`}>Sphere Assistant</p>
                <p className="text-xs text-slate-400">
                  Hi {user?.name} · {projectId ? "this project's chat" : "general chat"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setExpanded((e) => !e)}
                  className="text-slate-400 hover:text-brand-600 text-lg leading-none"
                  title={expanded ? "Shrink" : "Expand"}
                  aria-label={expanded ? "Shrink assistant panel" : "Expand assistant panel"}
                >
                  {expanded ? "⤡" : "⤢"}
                </button>
                <button onClick={clearHistory} className="text-xs text-slate-400 hover:text-red-500">
                  Clear
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                  aria-label="Close assistant"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto ${expanded ? "px-6 py-6" : "px-4 py-3"}`}>
              <div className={`space-y-3 ${expanded ? "max-w-3xl w-full mx-auto" : ""}`}>
                {messages.length === 0 && (
                  <p className="text-sm text-slate-400 text-center mt-8">
                    {projectId
                      ? "Ask about this project — try \"summarize recent activity\" or just say hi 👋"
                      : "Try: \"What's the status of my projects?\" or just say hi 👋"}
                  </p>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${expanded ? "max-w-[65%] text-base px-4 py-2.5" : "max-w-[80%]"} ${
                        m.role === "user"
                          ? "bg-brand-600 text-white rounded-br-sm"
                          : "bg-slate-100 text-slate-700 rounded-bl-sm"
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {status === "thinking" && (
                  <div className="flex justify-start">
                    <div className="bg-slate-100 text-slate-400 px-3 py-2 rounded-2xl text-sm italic">
                      Sphere is thinking...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            <div className="px-4 py-2 text-xs text-center text-slate-400 flex-shrink-0">{statusLabel[status]}</div>

            <form
              onSubmit={handleTextSend}
              className={`border-t border-slate-200 flex items-center gap-2 flex-shrink-0 ${
                expanded ? "px-6 py-4 max-w-3xl w-full mx-auto" : "p-3"
              }`}
            >
              <button
                type="button"
                onClick={startListening}
                className={`rounded-full flex items-center justify-center flex-shrink-0 ${
                  expanded ? "w-12 h-12 text-xl" : "w-10 h-10 text-lg"
                } ${status === "listening" ? "bg-red-500 text-white mic-listening" : "bg-brand-50 text-brand-600"}`}
                aria-label="Speak"
              >
                🎙️
              </button>
              <input
                className={`input ${expanded ? "text-base py-3" : "text-sm"}`}
                placeholder="Type a message..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                disabled={status === "thinking"}
              />
              <button
                type="submit"
                className={`btn btn-primary ${expanded ? "text-base px-5 py-3" : "text-sm px-3"}`}
                disabled={status === "thinking"}
              >
                Send
              </button>
            </form>
          </div>
        </>
      )}
    </>
  );
}