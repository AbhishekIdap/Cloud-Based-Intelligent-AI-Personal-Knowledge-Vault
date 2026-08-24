"use client";

import { X, Archive } from "lucide-react";
import { CATEGORIES } from "../lib/constants";

const AVATAR_COLORS = {
  sage: "var(--c-sage)",
  clay: "var(--c-clay)",
  gold: "var(--c-gold)",
  rose: "var(--c-rose)",
};

export function Avatar({ initials, color = "sage", size = 36 }) {
  return (
    <div
      className="lg-avatar"
      style={{ width: size, height: size, fontSize: size * 0.4, background: AVATAR_COLORS[color] || AVATAR_COLORS.sage }}
    >
      {initials}
    </div>
  );
}

export function CategoryIcon({ category, size = 18 }) {
  const cat = CATEGORIES[category] || CATEGORIES.document;
  const Icon = cat.icon;
  return <Icon size={size} color={cat.accent} />;
}

export function CategoryBadge({ category }) {
  const cat = CATEGORIES[category] || CATEGORIES.document;
  return (
    <span className="lg-tag" style={{ background: cat.bg, color: cat.accent }}>
      {cat.singular}
    </span>
  );
}

export function EmptyState({ icon: Icon = Archive, title, body, action }) {
  return (
    <div className="lg-empty">
      <div className="lg-empty-icon">
        <Icon size={24} />
      </div>
      <h3 style={{ fontSize: 17 }}>{title}</h3>
      {body && <p style={{ fontSize: 13.5, color: "var(--c-taupe)", maxWidth: 320 }}>{body}</p>}
      {action}
    </div>
  );
}

export function Switch({ on, onToggle }) {
  return (
    <button type="button" className={`lg-switch ${on ? "on" : ""}`} onClick={onToggle} aria-pressed={on}>
      <span className="lg-switch-knob" />
    </button>
  );
}

export function ConfirmModal({ title, body, confirmLabel = "Confirm", danger, onConfirm, onClose }) {
  return (
    <div className="lg-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lg-modal lg-fade-in" style={{ maxWidth: 380 }}>
        <div className="lg-modal-body" style={{ paddingTop: 26 }}>
          <h3 style={{ fontSize: 17, marginBottom: 8 }}>{title}</h3>
          <p style={{ fontSize: 13.5, color: "var(--c-taupe)", lineHeight: 1.55 }}>{body}</p>
        </div>
        <div className="lg-modal-footer">
          <button className="lg-btn lg-btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className={`lg-btn ${danger ? "lg-btn-danger" : "lg-btn-primary"}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="lg-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`lg-modal lg-fade-in ${wide ? "lg-modal-wide" : ""}`}>
        <div className="lg-modal-header">
          <h3 style={{ fontSize: 18 }}>{title}</h3>
          <button className="lg-icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="lg-modal-body">{children}</div>
        {footer && <div className="lg-modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
