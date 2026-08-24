"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkle, Loader2 } from "lucide-react";
import { api } from "../../../lib/api";
import { useActiveFile } from "../../../components/ActiveFileContext";
import { useCollections } from "../../../lib/hooks";
import { FileCard } from "../../../components/FileList";
import { Avatar } from "../../../components/ui";
import { useAuth } from "../../../lib/auth-context";

const PROMPTS = ["Show my starred files", "How much storage am I using?", "What's coming up in my reminders?", "What's in my most recent collection?"];

export default function AiAssistantPage() {
  const { user } = useAuth();
  const { openFile } = useActiveFile();
  const { collections } = useCollections();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const collectionsById = Object.fromEntries(collections.map((c) => [c.id, c]));

  useEffect(() => {
    api
      .get("/assistant/messages")
      .then(({ messages }) => setMessages(messages.map((m) => ({ ...m, files: [] }))))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  async function send(text) {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    setMessages((m) => [...m, { id: `local_${Date.now()}`, role: "user", content, files: [] }]);
    setSending(true);
    try {
      const { message, files } = await api.post("/assistant/messages", { content });
      setMessages((m) => [...m, { ...message, files }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="lg-fade-in">
      <div style={{ marginBottom: 18 }}>
        <div className="lg-eyebrow" style={{ marginBottom: 6 }}>
          AI Assistant
        </div>
        <h1 style={{ fontSize: 26 }}>Ask about your vault</h1>
      </div>

      <div className="lg-card lg-card-pad lg-chat-wrap">
        <div className="lg-chat-scroll" ref={scrollRef}>
          {loading && (
            <div style={{ display: "flex", justifyContent: "center", padding: 20, color: "var(--c-taupe)" }}>
              <Loader2 size={16} className="lg-spin" />
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <div className="lg-chat-avatar" style={{ background: "var(--c-sage-tint)", margin: "0 auto 14px" }}>
                <Bot size={16} color="var(--c-sage)" />
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>Ask me anything about your vault</h3>
              <p style={{ fontSize: 13, color: "var(--c-taupe)", maxWidth: 320, margin: "0 auto 16px" }}>
                I can pull up collections, find files, check storage, or list reminders.
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {PROMPTS.map((p) => (
                  <button key={p} className="lg-prompt-chip" onClick={() => send(p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`lg-msg-row ${m.role}`}>
              <div className="lg-chat-avatar" style={{ background: m.role === "user" ? "var(--c-ink)" : "var(--c-sage-tint)" }}>
                {m.role === "user" ? (
                  <Avatar initials={user?.avatar_initials} color={user?.avatar_color} size={30} />
                ) : (
                  <Bot size={15} color="var(--c-sage)" />
                )}
              </div>
              <div>
                <div className="lg-msg-bubble">{m.content}</div>
                {m.files?.length > 0 && (
                  <div className="lg-file-grid" style={{ marginTop: 10, gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                    {m.files.map((f) => (
                      <FileCard key={f.id} file={f} collection={collectionsById[f.collection_id]} onOpen={openFile} onToggleStar={() => {}} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && (
            <div className="lg-msg-row assistant">
              <div className="lg-chat-avatar" style={{ background: "var(--c-sage-tint)" }}>
                <Bot size={15} color="var(--c-sage)" />
              </div>
              <div className="lg-msg-bubble">
                <Loader2 size={14} className="lg-spin" />
              </div>
            </div>
          )}
        </div>

        <div className="lg-chat-input-bar">
          <Sparkle size={16} color="var(--c-sage)" />
          <input
            placeholder="Ask about a collection, a file, storage, reminders…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
          />
          <button className="lg-btn lg-btn-accent lg-btn-sm" onClick={() => send()} disabled={!input.trim() || sending}>
            <Send size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}
