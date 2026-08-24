"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Modal } from "./ui";
import { api } from "../lib/api";

const ICON_CHOICES = ["📁", "🎓", "🌴", "🏡", "💼", "📷", "🎵", "🐾", "💪", "📚", "🎬", "🍳"];
const COLOR_CHOICES = ["sage", "clay", "gold", "rose"];

export default function NewCollectionModal({ onClose, onCreated }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("📁");
  const [color, setColor] = useState("sage");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { collection } = await api.post("/collections", {
        name: name.trim(),
        description: description.trim(),
        icon,
        color,
      });
      onCreated?.(collection);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New collection"
      onClose={onClose}
      footer={
        <>
          <button className="lg-btn lg-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="lg-btn lg-btn-accent" disabled={!name.trim() || saving} onClick={submit}>
            <Plus size={14} /> Create collection
          </button>
        </>
      }
    >
      <div className="lg-field">
        <label className="lg-label">Name</label>
        <input className="lg-input" autoFocus placeholder="e.g. Kerala Trip 2026" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="lg-field">
        <label className="lg-label">Description (optional)</label>
        <input className="lg-input" placeholder="What lives in here?" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="lg-help">LifeGraph also uses this to match future uploads to this collection.</div>
      </div>
      <div className="lg-field">
        <label className="lg-label">Icon</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {ICON_CHOICES.map((ic) => (
            <button
              key={ic}
              onClick={() => setIcon(ic)}
              style={{
                width: 38,
                height: 38,
                fontSize: 18,
                borderRadius: 11,
                cursor: "pointer",
                border: icon === ic ? "2px solid var(--c-sage)" : "1px solid var(--c-sand)",
                background: "var(--c-paper)",
              }}
            >
              {ic}
            </button>
          ))}
        </div>
      </div>
      <div className="lg-field">
        <label className="lg-label">Color</label>
        <div style={{ display: "flex", gap: 8 }}>
          {COLOR_CHOICES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                cursor: "pointer",
                background: `var(--c-${c})`,
                border: color === c ? "2px solid var(--c-ink)" : "2px solid transparent",
                boxShadow: color === c ? "0 0 0 2px var(--c-paper)" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
