import React, { useState, useRef, useEffect } from "react";
import toast from "react-hot-toast";
import api from "../api/axios.js";
import { useAuth } from "../context/AuthContext.jsx";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Group chats like ChatGPT: Today / Yesterday / Previous 7 days / Older
const groupConversations = (list) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 24 * 60 * 60 * 1000;
  const groups = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  list.forEach((c) => {
    const t = new Date(c.updatedAt).getTime();
    if (t >= startOfToday.getTime()) groups[0].items.push(c);
    else if (t >= startOfToday.getTime() - day) groups[1].items.push(c);
    else if (t >= startOfToday.getTime() - 7 * day) groups[2].items.push(c);
    else groups[3].items.push(c);
  });
  return groups.filter((g) => g.items.length > 0);
};

export default function VoiceAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile drawer
  const [conversations, setConversations] = useState([]); // sidebar history
  const [activeId, setActiveId] = useState(null); // null = brand new chat
  const [loadingChat, setLoadingChat] = useState(false);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | listening | thinking | speaking
  const [micSupported] = useState(!!SpeechRecognition);

  const recognitionRef = useRef(null);
  const messagesEndRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  // Refs so async callbacks (voice results, API responses) always see the latest chat
  const activeIdRef = useRef(null);
  const sessionRef = useRef(0); // bumps every time the user switches chat / closes

  // ---------- helpers ----------
  const stopSpeaking = () => {
    if (synthRef.current) synthRef.current.cancel();
  };

  const loadConversations = async () => {
    try {
      const res = await api.get("/assistant/conversations");
      setConversations(res.data.conversations || []);
    } catch {
      // sidebar is non-critical; ignore
    }
  };

  const startNewChat = () => {
    sessionRef.current += 1;
    activeIdRef.current = null;
    setActiveId(null);
    setMessages([]);
    setTextInput("");
    setStatus("idle");
    setLoadingChat(false);
    setSidebarOpen(false);
    stopSpeaking();
  };

  const openConversation = async (id) => {
    if (id === activeIdRef.current) {
      setSidebarOpen(false);
      return;
    }
    sessionRef.current += 1;
    const mySession = sessionRef.current;
    activeIdRef.current = id;
    setActiveId(id);
    setMessages([]);
    setStatus("idle");
    setLoadingChat(true);
    setSidebarOpen(false);
    stopSpeaking();
    try {
      const res = await api.get(`/assistant/conversations/${id}`);
      if (sessionRef.current !== mySession) return; // user moved on
      setMessages(res.data.conversation.messages.map((m) => ({ role: m.role, content: m.content })));
    } catch {
      if (sessionRef.current !== mySession) return;
      toast.error("Couldn't load that conversation");
      startNewChat();
      loadConversations();
    } finally {
      if (sessionRef.current === mySession) setLoadingChat(false);
    }
  };

  const deleteConversation = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await api.delete(`/assistant/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      if (activeIdRef.current === id) startNewChat();
      toast.success("Conversation deleted");
    } catch {
      toast.error("Failed to delete conversation");
    }
  };

  // ---------- open / close ----------
  // Every time the robot is clicked the assistant opens on a NEW chat (like ChatGPT).
  // Old chats live in the sidebar (expanded view).
  useEffect(() => {
    if (open) {
      startNewChat();
      loadConversations();
    } else {
      sessionRef.current += 1; // ignore any reply still in flight
      stopSpeaking();
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore
      }
      setStatus("idle");
      setSidebarOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status, loadingChat]);

  // ---------- talking ----------
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
    const mySession = sessionRef.current;
    const conversationId = activeIdRef.current;

    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setStatus("thinking");
    try {
      // No conversationId => backend creates a new chat; otherwise continues that chat
      const res = await api.post("/assistant/chat", {
        message,
        ...(conversationId ? { conversationId } : {}),
      });

      if (sessionRef.current === mySession) {
        activeIdRef.current = res.data.conversationId;
        setActiveId(res.data.conversationId);
        setMessages((prev) => [...prev, { role: "assistant", content: res.data.reply }]);
        speak(res.data.reply);
      }
      loadConversations(); // refresh sidebar (new chat appears / chat moves to top)
    } catch (err) {
      const errMsg = err.response?.data?.message || "Sorry, I couldn't process that. Please try again.";
      if (sessionRef.current === mySession) {
        setMessages((prev) => [...prev, { role: "assistant", content: errMsg }]);
        setStatus("idle");
      }
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
    if (status === "thinking") return;

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
      } else if (event.error !== "aborted") {
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

  const statusLabel = {
    idle: "Tap mic or type to talk to Sphere",
    listening: "🎙️ Listening...",
    thinking: "💭 Thinking...",
    speaking: "🔊 Speaking...",
  };

  const activeTitle = conversations.find((c) => c._id === activeId)?.title || "New chat";
  const grouped = groupConversations(conversations);

  // ---------- shared UI pieces ----------
  const renderMessages = (large) => (
    <>
      {loadingChat && <p className="text-sm text-slate-400 text-center mt-8">Loading conversation...</p>}
      {!loadingChat && messages.length === 0 && (
        <p className="text-sm text-slate-400 text-center mt-8">
          Try: "What's the status of my projects?" or just say hi 👋
        </p>
      )}
      {messages.map((m, i) => (
        <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`${large ? "max-w-[70%] px-4 py-2.5 text-base" : "max-w-[80%] px-3 py-2 text-sm"} rounded-2xl whitespace-pre-wrap break-words ${
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
          <div
            className={`bg-slate-100 text-slate-400 rounded-2xl italic ${
              large ? "px-4 py-2.5 text-base" : "px-3 py-2 text-sm"
            }`}
          >
            Sphere is thinking...
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
    </>
  );

  const renderInput = (large) => (
    <>
      <button
        type="button"
        onClick={startListening}
        className={`${large ? "w-12 h-12 text-xl" : "w-10 h-10 text-lg"} rounded-full flex items-center justify-center flex-shrink-0 ${
          status === "listening" ? "bg-red-500 text-white mic-listening" : "bg-brand-50 text-brand-600"
        }`}
        aria-label="Speak"
      >
        🎙️
      </button>
      <input
        className={`input ${large ? "text-base py-3" : "text-sm"}`}
        placeholder="Type a message..."
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        disabled={status === "thinking" || loadingChat}
      />
      <button
        type="submit"
        className={`btn btn-primary ${large ? "text-base px-5 py-3" : "text-sm px-3"}`}
        disabled={status === "thinking" || loadingChat}
      >
        Send
      </button>
    </>
  );

  // ChatGPT-style sidebar: "+ New conversation" + full chat history
  const renderSidebar = () => (
    <>
      <div className="flex items-center gap-2 mb-4">
        <span className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center text-sm font-bold">
          S
        </span>
        <span className="font-semibold text-brand-700">Sphere</span>
      </div>

      <button onClick={startNewChat} className="btn btn-primary text-sm w-full mb-4">
        ＋ New conversation
      </button>

      <div className="flex-1 overflow-y-auto -mx-1 px-1">
        {grouped.length === 0 && (
          <p className="text-xs text-slate-400 px-2 mt-2">Your chats will show up here.</p>
        )}
        {grouped.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 px-2 mb-1">
              {group.label}
            </p>
            {group.items.map((c) => (
              <div key={c._id} className="group relative">
                <button
                  onClick={() => openConversation(c._id)}
                  title={c.title}
                  className={`w-full text-left truncate px-3 py-2 pr-9 rounded-lg text-sm transition-colors ${
                    c._id === activeId
                      ? "bg-brand-100 text-brand-700 font-medium"
                      : "text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {c.title}
                </button>
                <button
                  onClick={(e) => deleteConversation(c._id, e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-red-500 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  aria-label="Delete conversation"
                  title="Delete"
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-200 mt-2">
        <p className="text-xs text-slate-400 mb-2 truncate">Hi {user?.name} 👋</p>
        <button onClick={() => setExpanded(false)} className="btn btn-secondary text-sm w-full">
          ⤡ Shrink
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Floating toggle button — opening it always starts a NEW chat */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 w-14 h-14 rounded-full bg-brand-600 text-white shadow-lg flex items-center justify-center text-2xl hover:bg-brand-700 z-30"
        aria-label="Open AI assistant"
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* ============ EXPANDED (full screen) ============ */}
      {open && expanded && (
        <div className="fixed inset-0 bg-white z-30 flex">
          {/* Desktop sidebar */}
          <div className="hidden sm:flex w-64 flex-shrink-0 bg-slate-50 border-r border-slate-200 flex-col p-4">
            {renderSidebar()}
          </div>

          {/* Mobile sidebar drawer */}
          {sidebarOpen && (
            <div className="sm:hidden fixed inset-0 z-40 flex">
              <div className="w-72 max-w-[80vw] bg-slate-50 flex flex-col p-4 shadow-xl">{renderSidebar()}</div>
              <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
            </div>
          )}

          {/* Main chat column */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="px-4 sm:px-8 py-4 border-b border-slate-200 flex items-center justify-between flex-shrink-0 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="sm:hidden text-slate-500 hover:text-brand-600 text-xl leading-none"
                  aria-label="Show chat history"
                >
                  ☰
                </button>
                <p className="font-semibold text-brand-700 truncate">{activeId ? activeTitle : "New chat"}</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <button
                  onClick={startNewChat}
                  className="sm:hidden text-slate-500 hover:text-brand-600 text-lg leading-none"
                  title="New chat"
                  aria-label="New chat"
                >
                  ＋
                </button>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-slate-400 hover:text-brand-600 text-lg leading-none"
                  title="Shrink"
                  aria-label="Shrink assistant panel"
                >
                  ⤡
                </button>
                <button
                  onClick={() => {
                    setExpanded(false);
                    setOpen(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                  aria-label="Close assistant"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="max-w-2xl mx-auto w-full px-4 py-8 space-y-4">{renderMessages(true)}</div>
            </div>

            <div className="text-xs text-center text-slate-400 py-1 flex-shrink-0">{statusLabel[status]}</div>

            <form
              onSubmit={handleTextSend}
              className="border-t border-slate-200 flex-shrink-0 px-4 sm:px-8 py-4"
            >
              <div className="max-w-2xl mx-auto w-full flex items-center gap-2">{renderInput(true)}</div>
            </form>
          </div>
        </div>
      )}

      {/* ============ POPUP (small) ============ */}
      {open && !expanded && (
        <div className="fixed bottom-24 right-5 w-[90vw] max-w-sm h-[520px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-30">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between flex-shrink-0 gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-brand-700 truncate">{activeId ? activeTitle : "New chat"}</p>
              <p className="text-xs text-slate-400 truncate">Hi {user?.name}, ask me anything</p>
            </div>
            <div className="flex items-center gap-4 flex-shrink-0">
              <button
                onClick={startNewChat}
                className="text-slate-400 hover:text-brand-600 text-lg leading-none"
                title="New chat"
                aria-label="New chat"
              >
                ＋
              </button>
              <button
                onClick={() => setExpanded(true)}
                className="text-slate-400 hover:text-brand-600 text-lg leading-none"
                title="Expand to see chat history"
                aria-label="Expand assistant panel"
              >
                ⤢
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

          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="space-y-3">{renderMessages(false)}</div>
          </div>

          <div className="px-4 py-2 text-xs text-center text-slate-400 flex-shrink-0">{statusLabel[status]}</div>

          <form onSubmit={handleTextSend} className="p-3 border-t border-slate-200 flex items-center gap-2 flex-shrink-0">
            {renderInput(false)}
          </form>
        </div>
      )}
    </>
  );
}