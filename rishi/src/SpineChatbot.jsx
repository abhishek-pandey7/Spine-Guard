import { useState, useRef, useEffect } from "react";
import "./SpineChatbot.css";

const API_BASE = "http://localhost:8000";

export default function SpineChatbot({ patientContext, onReset }) {
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  const userId = patientContext?.user?.id;

  useEffect(() => {
    if (userId) initChats();
  }, [userId]);

  async function initChats() {
    setSidebarLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chats?user_id=${userId}`);
      if (!res.ok) throw new Error("Failed to load chats");
      const data = await res.json();
      setChats(data);
      if (data.length > 0) {
        await loadChatHistory(data[0].id);
      } else {
        await createNewChat(true);
      }
    } catch (err) {
      setError("Could not load chat history. Is the backend running?");
    } finally {
      setSidebarLoading(false);
    }
  }

  async function createNewChat(silent = false) {
    try {
      if (!silent) setSidebarLoading(true);
      const res = await fetch(`${API_BASE}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          title: "New Chat",
        }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const newChat = await res.json();
      setChats((prev) => [newChat, ...prev]);
      setCurrentChatId(newChat.id);
      setMessages([{
        role: "ai",
        content: `Hello${patientContext?.user?.full_name ? ` ${patientContext.user.full_name}` : ""}! I'm SpineIQ — your AI recovery assistant. You're on Day ${patientContext?.days_post_op ?? "?"} of your ${patientContext?.surgery_type ?? "spine"} recovery. How can I help you today?`,
      }]);
      setError(null);
    } catch (err) {
      setError("Unable to create a new chat. Make sure the backend is running on port 8000.");
    } finally {
      setSidebarLoading(false);
    }
  }

  async function loadChatHistory(chatId) {
    setCurrentChatId(chatId);
    setMessages([]);
    setIsTyping(true);
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}/history`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const history = data.map((m) => ({
        role: m.type === "human" ? "user" : "ai",
        content: m.content,
      }));
      setMessages(history.length > 0 ? history : [{ role: "ai", content: "Hello! I'm your SpineIQ assistant. Ask me anything about your recovery." }]);
      setError(null);
    } catch {
      setError("Failed to load messages for this chat.");
    } finally {
      setIsTyping(false);
    }
  }

  async function deleteChat(chatId, e) {
    e.stopPropagation();
    try {
      const res = await fetch(`${API_BASE}/chats/${chatId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const remaining = chats.filter((c) => c.id !== chatId);
      setChats(remaining);
      if (currentChatId === chatId) {
        if (remaining.length > 0) await loadChatHistory(remaining[0].id);
        else await createNewChat(true);
      }
    } catch {
      setError("Failed to delete chat.");
    }
  }

  async function handleSendMessage(e) {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && !file) return;
    if (!currentChatId) return;

    const userContent = trimmed || `Uploaded: ${file.name}`;
    // Capture preview before clearing file state
    let filePreview = null;
    if (file) {
      if (file.type.startsWith("image/")) {
        filePreview = await new Promise((res) => {
          const reader = new FileReader();
          reader.onload = (ev) => res({ kind: "image", src: ev.target.result, name: file.name });
          reader.readAsDataURL(file);
        });
      } else {
        filePreview = { kind: "file", name: file.name };
      }
    }
    setMessages((prev) => [...prev, { role: "user", content: userContent, filePreview }]);
    setInput("");
    setIsTyping(true);
    setError(null);
    const sentFile = file;
    setFile(null);

    try {
      let data;
      if (sentFile) {
        const form = new FormData();
        form.append("chat_id", currentChatId);
        form.append("user_id", userId);
        form.append("message", trimmed);
        form.append("patient_context", JSON.stringify(patientContext));
        form.append("file", sentFile);
        const res = await fetch(`${API_BASE}/chat/upload`, { method: "POST", body: form });
        if (!res.ok) throw new Error(await res.text());
        data = await res.json();
      } else {
        const res = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: currentChatId, user_id: userId, message: trimmed, patient_context: patientContext }),
        });
        if (!res.ok) throw new Error(await res.text());
        data = await res.json();
      }
      if (data?.response) {
        setMessages((prev) => [...prev, { role: "ai", content: data.response }]);
        if (data.new_title) {
          setChats((prev) => prev.map((c) => c.id === currentChatId ? { ...c, title: data.new_title } : c));
        }
        if (data.red_flag) setError("⚠️ Red Flag symptoms detected. Please contact your surgeon or visit the ER immediately.");
      } else {
        throw new Error("Empty response from server.");
      }
    } catch (err) {
      console.error(err);
      setError("⚠️ Unable to reach SpineIQ backend. Make sure the FastAPI server is running on port 8000.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsTyping(false);
    }
  }

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  // Render message text: convert **bold** markdown into real <strong> tags
  function renderContent(text) {
    if (!text) return null;
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i}>{part}</strong> : <span key={i}>{part}</span>
    );
  }

  return (
    <div className="spine-app">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <span className="sidebar-logo">🦴</span>
          <span className="sidebar-title">SpineIQ</span>
          <button className="new-chat-btn" onClick={() => createNewChat()} title="New Chat">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        <div className="sidebar-user">
          <div className="sidebar-avatar">{patientContext?.user?.full_name?.[0]?.toUpperCase() ?? "U"}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{patientContext?.user?.full_name ?? "User"}</span>
            <span className="sidebar-user-role">{patientContext?.user?.role ?? "patient"}</span>
          </div>
        </div>
        <div className="chat-list-label" onClick={() => setHistoryOpen((o) => !o)}>
          <span>HISTORY</span>
          <span className={`history-chevron ${historyOpen ? "open" : ""}`}>▼</span>
        </div>
        {historyOpen && (
        <div className="chat-list">
          {sidebarLoading ? (
            <div className="sidebar-skeleton">{[1,2,3].map((i) => <div key={i} className="skeleton-item" />)}</div>
          ) : chats.length === 0 ? (
            <p className="no-chats">No chats yet</p>
          ) : (
            chats.map((c) => (
              <button key={c.id} className={`chat-item ${currentChatId === c.id ? "active" : ""}`} onClick={() => loadChatHistory(c.id)}>
                <span className="chat-icon">💬</span>
                <span className="chat-title">{c.title}</span>
                <span className="chat-delete-btn" onClick={(e) => deleteChat(c.id, e)}>✕</span>
              </button>
            ))
          )}
        </div>
        )}
        <button className="reset-config-btn" onClick={onReset}>⚙ Change Context</button>
      </aside>

      <main className="chat-main">
        <header className="chat-header">
          <div className="header-info">
            <h1>AI SpineIQ</h1>
            <p>{patientContext?.surgery_type} · Day {patientContext?.days_post_op}</p>
          </div>
          <div className="header-actions">
            <span className={`status-dot ${isTyping ? "typing" : "online"}`} />
            <span>{isTyping ? "Thinking…" : "Ready"}</span>
            <button className="header-back-btn" onClick={onReset} title="Back to home">← Back</button>
          </div>
        </header>

        <div className="messages-container">
          {messages.map((m, idx) => (
            <div key={idx} className={`message-bubble ${m.role}`}>
              {m.role === "ai" && <span className="bubble-avatar">🦴</span>}
              <div className="bubble-content">
                {m.filePreview && m.filePreview.kind === "image" && (
                  <img
                    src={m.filePreview.src}
                    alt={m.filePreview.name}
                    className="msg-img-preview"
                  />
                )}
                {m.filePreview && m.filePreview.kind === "file" && (
                  <div className="msg-file-badge">📎 {m.filePreview.name}</div>
                )}
                {renderContent(m.content)}
              </div>
              <div className="bubble-meta">{m.role === "ai" ? "SpineIQ" : "You"}</div>
            </div>
          ))}
          {isTyping && (
            <div className="message-bubble ai">
              <span className="bubble-avatar">🦴</span>
              <div className="bubble-content typing-indicator"><span /><span /><span /></div>
            </div>
          )}
          {error && (
            <div className="error-toast">{error}<button onClick={() => setError(null)}>✕</button></div>
          )}
          <div ref={scrollRef} />
        </div>

        <form className="chat-input-area" onSubmit={handleSendMessage}>
          {file && (
            <div className="file-preview">
              <span>📎 {file.name}</span>
              <button type="button" onClick={() => setFile(null)}>✕</button>
            </div>
          )}
          <div className="input-row">
            <button type="button" className="attach-btn" onClick={() => fileRef.current?.click()}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <input type="file" ref={fileRef} hidden accept="image/*,application/pdf" onChange={(e) => { if (e.target.files[0]) setFile(e.target.files[0]); e.target.value = ""; }} />
            <textarea ref={textareaRef} rows={1} placeholder="Ask about your spine recovery…" value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} />
            <button type="submit" className="send-btn" disabled={isTyping || (!input.trim() && !file)}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
