import { useState, useRef, useEffect } from "react";

const API_BASE = "http://localhost:8000";

// Get or create a session ID per browser tab
const SESSION_ID = crypto.randomUUID();

export default function SpineChatbot({ patientContext }) {
    // patientContext passed as prop from parent — contains surgery_type, days_post_op, etc.
    const [messages, setMessages] = useState([
        { role: "ai", content: "Hi! I'm SpineIQ, your recovery assistant. How can I help you today?" }
    ]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [file, setFile] = useState(null);
    const fileInputRef = useRef();
    const bottomRef = useRef();

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const sendMessage = async () => {
        if (!input.trim() && !file) return;

        const userMsg = { role: "user", content: input, file: file?.name };
        setMessages(prev => [...prev, userMsg]);
        setLoading(true);

        try {
            let data;

            if (file) {
                // Multipart form for file upload
                const formData = new FormData();
                formData.append("session_id", SESSION_ID);
                formData.append("message", input);
                formData.append("patient_context", JSON.stringify(patientContext));
                formData.append("file", file);

                const res = await fetch(`${API_BASE}/chat/upload`, {
                    method: "POST",
                    body: formData
                });
                data = await res.json();
            } else {
                const res = await fetch(`${API_BASE}/chat`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        session_id: SESSION_ID,
                        message: input,
                        patient_context: patientContext
                    })
                });
                data = await res.json();
            }

            setMessages(prev => [...prev, {
                role: "ai",
                content: data.response,
                isRedFlag: data.red_flag
            }]);

        } catch (err) {
            setMessages(prev => [...prev, { role: "ai", content: "Something went wrong. Please try again." }]);
        }

        setInput("");
        setFile(null);
        setLoading(false);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "600px", border: "1px solid #ddd", borderRadius: "12px" }}>
            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{
                        marginBottom: "12px",
                        textAlign: msg.role === "user" ? "right" : "left"
                    }}>
                        <span style={{
                            display: "inline-block",
                            padding: "10px 14px",
                            borderRadius: "18px",
                            maxWidth: "75%",
                            background: msg.isRedFlag ? "#fee2e2" : msg.role === "user" ? "#3b82f6" : "#f3f4f6",
                            color: msg.role === "user" ? "#fff" : "#111"
                        }}>
                            {msg.file && <div style={{ fontSize: "12px", marginBottom: "4px" }}>📎 {msg.file}</div>}
                            {msg.content}
                        </span>
                    </div>
                ))}
                {loading && <div style={{ color: "#888" }}>SpineIQ is thinking...</div>}
                <div ref={bottomRef} />
            </div>

            {/* File preview */}
            {file && (
                <div style={{ padding: "8px 16px", background: "#f0fdf4", fontSize: "13px" }}>
                    📎 {file.name} <button onClick={() => setFile(null)}>✕</button>
                </div>
            )}

            {/* Input Area */}
            <div style={{ display: "flex", padding: "12px", borderTop: "1px solid #eee", gap: "8px" }}>
                <input
                    type="file"
                    accept=".pdf,image/*"
                    ref={fileInputRef}
                    style={{ display: "none" }}
                    onChange={e => setFile(e.target.files[0])}
                />
                <button onClick={() => fileInputRef.current.click()}>📎</button>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && sendMessage()}
                    placeholder="Ask about your recovery..."
                    style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
                />
                <button onClick={sendMessage} disabled={loading}>Send</button>
            </div>
        </div>
    );
}