"use client";

import { useEffect, useState } from "react";
import { Trash2, Download, Save, Star, Eye, EyeOff, Loader2, FileQuestion, Pencil, Sparkles, RotateCw } from "lucide-react";
import { Modal, ConfirmModal, CategoryIcon, CategoryBadge } from "./ui";
import { CATEGORIES, formatBytes, formatDate } from "../lib/constants";
import { api } from "../lib/api";
import { useToast } from "./Toast";

// Media categories get an inline preview and a wider modal so there's room
// to actually see the thing. Documents/notes stay in the compact layout.
const PREVIEWABLE = new Set(["photo", "video", "recording", "pdf"]);

// Fetches a fresh presigned download URL for the file and renders the right
// kind of preview for its category — image, video, audio player, embedded
// PDF, or (for plain-text documents) the text itself. Falls back to a quiet
// "no inline preview" notice for anything else (e.g. .docx), since the
// Download button already covers that case.
function FilePreview({ file }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [url, setUrl] = useState(null);
  const [textContent, setTextContent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!file.storage_url) {
      setStatus("error");
      return undefined;
    }
    setStatus("loading");
    setTextContent(null);

    api
      .get(`/files/${file.id}/download-url`)
      .then(async ({ url }) => {
        if (cancelled) return;
        setUrl(url);
        if ((file.mime_type || "").startsWith("text/")) {
          const res = await fetch(url);
          const text = await res.text();
          if (!cancelled) setTextContent(text.slice(0, 20000));
        }
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [file.id, file.storage_url, file.mime_type]);

  if (!file.storage_url) return null; // notes have no stored object — nothing to preview

  if (status === "loading") {
    return (
      <div className="lg-preview-box">
        <Loader2 size={20} className="lg-spin" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="lg-preview-box">
        <FileQuestion size={26} color="var(--c-taupe)" />
        <span>Preview couldn't load — try Download instead.</span>
      </div>
    );
  }

  if (file.category === "photo") {
    return <img src={url} alt={file.name} className="lg-preview-media" />;
  }
  if (file.category === "video") {
    return <video src={url} controls className="lg-preview-media" />;
  }
  if (file.category === "recording") {
    return <audio src={url} controls className="lg-preview-audio" />;
  }
  if (file.category === "pdf") {
    return <iframe src={url} title={file.name} className="lg-preview-pdf" />;
  }
  if (textContent != null) {
    return <pre className="lg-preview-text">{textContent}</pre>;
  }
  return (
    <div className="lg-preview-box">
      <CategoryIcon category={file.category} size={26} />
      <span>No inline preview for this file type — use Download to open it.</span>
    </div>
  );
}

export default function FileDetailModal({ file, collections, onClose, onChanged, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteDraft, setNoteDraft] = useState(file.note_content || "");
  const [descriptionDraft, setDescriptionDraft] = useState(file.description || "");
  const [nameDraft, setNameDraft] = useState(file.name || "");
  const [renaming, setRenaming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const meta = CATEGORIES[file.category];
  const { push } = useToast();

  async function patch(body) {
    const { file: updated } = await api.patch(`/files/${file.id}`, body);
    onChanged?.(updated);
    return updated;
  }

  async function handleDownload() {
    if (!file.storage_url) {
      push("Notes don't have a downloadable file.", "info");
      return;
    }
    const { url } = await api.get(`/files/${file.id}/download-url`);
    window.open(url, "_blank");
  }

  async function handleSave() {
    if (!nameDraft.trim()) {
      push("File name can't be empty.", "error");
      return;
    }
    setSaving(true);
    try {
      await patch({ name: nameDraft.trim(), note_content: noteDraft, description: descriptionDraft });
      push("Saved.");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await api.delete(`/files/${file.id}`);
    onDeleted?.(file.id);
    push("File deleted.");
    onClose();
  }

  async function handleRegenerateSummary() {
    setRegenerating(true);
    try {
      await api.summarizeFile(file.id);
      push("Reading this file's contents — the AI summary will update shortly.");
      onChanged?.({ ...file, ai_summary_status: "pending" });
    } catch (err) {
      push(err.message || "Couldn't generate an AI summary for this file.", "error");
    } finally {
      setRegenerating(false);
    }
  }

  return (
    <>
      <Modal
        title={file.name}
        onClose={onClose}
        wide={PREVIEWABLE.has(file.category)}
        footer={
          <>
            <button className="lg-btn lg-btn-danger" style={{ marginRight: "auto" }} onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} /> Delete
            </button>
            <button
              className="lg-btn lg-btn-ghost"
              onClick={() => {
                setRenaming((r) => !r);
                setNameDraft(file.name || "");
              }}
            >
              <Pencil size={14} /> Rename
            </button>
            <button className="lg-btn lg-btn-ghost" onClick={handleDownload}>
              <Download size={14} /> Download
            </button>
            <button className="lg-btn lg-btn-primary" onClick={handleSave} disabled={saving}>
              <Save size={14} /> Save
            </button>
          </>
        }
      >
        {file.storage_url && (
          <div style={{ marginBottom: 16 }}>
            <FilePreview file={file} />
          </div>
        )}

        <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
          <div className="lg-row-icon" style={{ width: 56, height: 56, background: meta.bg, borderRadius: 14 }}>
            <CategoryIcon category={file.category} size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
              <CategoryBadge category={file.category} />
              {file.starred && (
                <span className="lg-tag" style={{ background: "var(--c-gold-tint)", color: "var(--c-gold)" }}>
                  Starred
                </span>
              )}
              {file.hidden && (
                <span className="lg-tag" style={{ background: "var(--c-sand)", color: "var(--c-ink-soft)" }}>
                  Hidden
                </span>
              )}
            </div>
            <div className="lg-mono" style={{ fontSize: 12, color: "var(--c-taupe)" }}>
              {formatBytes(file.size_kb)} · added {formatDate(file.created_at)}
            </div>
          </div>
        </div>

        {renaming && (
          <div className="lg-field">
            <label className="lg-label">Name</label>
            <input
              className="lg-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              autoFocus
              placeholder="File name"
            />
          </div>
        )}

        <div className="lg-field">
          <label className="lg-label">Collection</label>
          <select
            className="lg-input"
            value={file.collection_id || ""}
            onChange={(e) => patch({ collection_id: e.target.value || null })}
          >
            <option value="">No collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg-field">
          <label className="lg-label">Description</label>
          <textarea
            className="lg-input"
            rows={2}
            style={{ fontSize: 12.5 }}
            value={descriptionDraft}
            onChange={(e) => setDescriptionDraft(e.target.value)}
            placeholder="A note about this file so search and the AI assistant can find it — e.g. &quot;Feb electricity bill, ₹2,340&quot;"
          />
        </div>

        {(file.category === "note" || file.note_content != null) && (
          <div className="lg-field">
            <label className="lg-label">Note content</label>
            <textarea className="lg-input" rows={6} value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Write something…" />
          </div>
        )}

        <div className="lg-field">
          <label className="lg-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Sparkles size={12} /> AI content summary
          </label>
          {file.ai_summary_status === "pending" && (
            <div style={{ fontSize: 12.5, color: "var(--c-taupe)", display: "flex", alignItems: "center", gap: 6 }}>
              <Loader2 size={13} className="lg-spin" /> Reading this file's contents…
            </div>
          )}
          {file.ai_summary_status === "done" && file.ai_summary && (
            <div style={{ fontSize: 12.5, color: "var(--c-ink-soft)", background: "var(--c-sage-tint)", padding: "8px 10px", borderRadius: 8 }}>
              {file.ai_summary}
            </div>
          )}
          {(file.ai_summary_status === "skipped" || file.ai_summary_status === "failed") && (
            <button className="lg-btn lg-btn-ghost" style={{ fontSize: 12.5 }} onClick={handleRegenerateSummary} disabled={regenerating}>
              {regenerating ? <Loader2 size={13} className="lg-spin" /> : <RotateCw size={13} />}
              {file.ai_summary_status === "failed" ? "Retry AI summary" : "Generate AI summary"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button className="lg-btn lg-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => patch({ starred: !file.starred })}>
            <Star size={14} fill={file.starred ? "var(--c-gold)" : "none"} color={file.starred ? "var(--c-gold)" : "currentColor"} />
            {file.starred ? "Starred" : "Star this"}
          </button>
          <button className="lg-btn lg-btn-ghost" style={{ flex: 1, justifyContent: "center" }} onClick={() => patch({ hidden: !file.hidden })}>
            {file.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
            {file.hidden ? "Unhide" : "Hide"}
          </button>
        </div>
      </Modal>
      {confirmDelete && (
        <ConfirmModal
          title="Delete this file?"
          body={`"${file.name}" will be permanently removed from your vault. This can't be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}