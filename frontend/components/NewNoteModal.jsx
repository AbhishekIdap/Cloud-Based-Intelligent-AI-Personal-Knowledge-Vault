"use client";

import { useState } from "react";
import { Check, Loader2, StickyNote } from "lucide-react";
import { Modal } from "./ui";
import { api } from "../lib/api";
import { useToast } from "./Toast";

export default function NewNoteModal({ onClose, collections, defaultCollectionId = null, onCreated }) {
  const [name, setName] = useState("");
  const [noteContent, setNoteContent] = useState("");
  const [description, setDescription] = useState("");
  const [collectionId, setCollectionId] = useState(defaultCollectionId);
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const canSave = name.trim().length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await api.createNote({
        name: name.trim(),
        noteContent: noteContent.trim(),
        collectionId: collectionId || null,
        description: description.trim() || undefined,
      });
      push("Note added to your vault.");
      onCreated?.();
      onClose();
    } catch (err) {
      push(err.message || "Couldn't save that note — try again.", "error");
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New note"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="lg-btn lg-btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="lg-btn lg-btn-accent" disabled={!canSave} onClick={handleSave}>
            {saving ? <Loader2 size={15} className="lg-spin" /> : <Check size={15} />}
            {saving ? "Saving…" : "Save note"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--c-taupe)", fontSize: 12.5 }}>
          <StickyNote size={14} /> Notes live in your vault alongside files, and are just as searchable.
        </div>

        <div>
          <label className="lg-label">Title</label>
          <input
            className="lg-input"
            placeholder="e.g. Wifi password for mom's place"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        <div>
          <label className="lg-label">Note</label>
          <textarea
            className="lg-input"
            placeholder="Write anything — this is what search and the AI assistant will read."
            rows={6}
            style={{ resize: "vertical" }}
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
          />
        </div>

        <div>
          <label className="lg-label">Description (optional)</label>
          <textarea
            className="lg-input"
            placeholder="A short tag for your own reference — separate from the note body above."
            rows={2}
            style={{ resize: "vertical", fontSize: 12.5 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="lg-label">Collection</label>
          <select className="lg-input" value={collectionId || ""} onChange={(e) => setCollectionId(e.target.value || null)}>
            <option value="">No collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}
