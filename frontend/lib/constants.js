import { StickyNote, FileText, File as FileIcon, Image as ImageIcon, Video as VideoIcon, Mic } from "lucide-react";

export const CATEGORIES = {
  note: { label: "Notes", singular: "Note", icon: StickyNote, accent: "var(--c-sage)", bg: "var(--c-sage-tint)" },
  document: { label: "Documents", singular: "Document", icon: FileText, accent: "var(--c-clay)", bg: "var(--c-clay-tint)" },
  pdf: { label: "PDFs", singular: "PDF", icon: FileIcon, accent: "var(--c-rose)", bg: "var(--c-rose-tint)" },
  photo: { label: "Photos", singular: "Photo", icon: ImageIcon, accent: "var(--c-gold)", bg: "var(--c-gold-tint)" },
  video: { label: "Videos", singular: "Video", icon: VideoIcon, accent: "var(--c-ink)", bg: "var(--c-ink-tint)" },
  recording: { label: "Recordings", singular: "Recording", icon: Mic, accent: "var(--c-sage)", bg: "var(--c-sage-tint)" },
};
export const CATEGORY_ORDER = ["note", "document", "pdf", "photo", "video", "recording"];

export function formatBytes(kb) {
  const n = Number(kb) || 0;
  if (n < 1024) return `${n.toFixed(0)} KB`;
  const mb = n / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

export function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function timeAgo(iso) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatDate(iso);
}

// Instant client-side guess for a snappy UI while the file uploads — the
// backend recomputes this as the source of truth on confirm (see
// backend/src/lib/categorize.js and schema.sql note #1).
export function categorizeFile(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type.startsWith("image/")) return "photo";
  if (type.startsWith("video/")) return "video";
  if (type.startsWith("audio/")) return "recording";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (/\.(docx?|rtf|odt|pages)$/.test(name)) return "document";
  if (/\.(txt|md)$/.test(name)) return "note";
  if (/\.(jpe?g|png|gif|heic|webp)$/.test(name)) return "photo";
  if (/\.(mp4|mov|avi|mkv|webm)$/.test(name)) return "video";
  if (/\.(mp3|wav|m4a|aac)$/.test(name)) return "recording";
  return "document";
}

export function cx(...args) {
  return args.filter(Boolean).join(" ");
}
