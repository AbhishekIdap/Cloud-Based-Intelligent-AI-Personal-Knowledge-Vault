"use client";

import { useEffect, useState } from "react";
import { Search, Filter, LayoutGrid, List as ListIcon, Star } from "lucide-react";
import { CATEGORIES, CATEGORY_ORDER, formatBytes, formatDate, timeAgo, cx } from "../lib/constants";
import { EmptyState } from "./ui";
import { api } from "../lib/api";

export function ViewToggle({ view, onChange }) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--c-sand)", borderRadius: "var(--radius-pill)", padding: 3, gap: 2 }}>
      <button
        className="lg-icon-btn"
        style={{ width: 32, height: 32, background: view === "grid" ? "var(--c-sand)" : "transparent" }}
        onClick={() => onChange("grid")}
        aria-label="Grid view"
      >
        <LayoutGrid size={15} />
      </button>
      <button
        className="lg-icon-btn"
        style={{ width: 32, height: 32, background: view === "list" ? "var(--c-sand)" : "transparent" }}
        onClick={() => onChange("list")}
        aria-label="List view"
      >
        <ListIcon size={15} />
      </button>
    </div>
  );
}

export function FilterBar({ query, onQuery, category, onCategory, categories = CATEGORY_ORDER, sort, onSort, view, onView, extra }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginBottom: 18 }}>
      <div className="lg-search" style={{ maxWidth: 280 }}>
        <Search size={15} color="var(--c-taupe)" />
        <input placeholder="Filter by name…" value={query} onChange={(e) => onQuery(e.target.value)} />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {categories.length > 0 && (
          <button className={cx("lg-chip", category === "all" && "active")} onClick={() => onCategory("all")}>
            <Filter size={12} /> All
          </button>
        )}
        {categories.map((c) => (
          <button key={c} className={cx("lg-chip", category === c && "active")} onClick={() => onCategory(c)}>
            {CATEGORIES[c].label}
          </button>
        ))}
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {extra}
        <select className="lg-input lg-mono" style={{ width: 150, padding: "8px 10px", fontSize: 12.5 }} value={sort} onChange={(e) => onSort(e.target.value)}>
          <option value="recent">Recently viewed</option>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="largest">Largest first</option>
        </select>
        {onView && <ViewToggle view={view} onChange={onView} />}
      </div>
    </div>
  );
}

// Small client-side cache so switching sort/filter (which remounts cards)
// doesn't re-request a presigned URL for the same file every time — download
// URLs are valid for 10 minutes server-side (see s3.js), so 8 is a safe
// margin.
const thumbUrlCache = new Map(); // fileId -> { url, expiresAt }
const THUMB_TTL_MS = 8 * 60 * 1000;

function FileThumb({ file }) {
  const meta = CATEGORIES[file.category] || CATEGORIES.document;
  const Icon = meta.icon;
  const showsRealImage = file.category === "photo" && file.storage_url;
  const [imgUrl, setImgUrl] = useState(() => {
    const cached = thumbUrlCache.get(file.id);
    return cached && cached.expiresAt > Date.now() ? cached.url : file.thumbnail_url || null;
  });

  useEffect(() => {
    if (!showsRealImage || imgUrl) return;
    let cancelled = false;
    api
      .get(`/files/${file.id}/download-url`)
      .then(({ url }) => {
        if (cancelled) return;
        thumbUrlCache.set(file.id, { url, expiresAt: Date.now() + THUMB_TTL_MS });
        setImgUrl(url);
      })
      .catch(() => {}); // quietly fall back to the icon below
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, showsRealImage]);

  if (showsRealImage && imgUrl) {
    return (
      <div className="lg-file-thumb lg-file-thumb-photo">
        <img src={imgUrl} alt="" loading="lazy" onError={() => setImgUrl(null)} />
      </div>
    );
  }

  return (
    <div className="lg-file-thumb" style={{ background: meta.bg }}>
      <Icon size={30} color={meta.accent} />
    </div>
  );
}

export function FileCard({ file, collection, onOpen, onToggleStar }) {
  const caption = file.description || file.ai_summary;
  return (
    <div className="lg-file-card" onClick={() => onOpen(file)}>
      <button
        className="lg-file-star lg-icon-btn"
        style={{ width: 28, height: 28, background: "var(--c-paper)", border: "1px solid var(--c-sand)" }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(file);
        }}
        aria-label="Toggle star"
      >
        <Star size={13} color={file.starred ? "var(--c-gold)" : "var(--c-taupe)"} fill={file.starred ? "var(--c-gold)" : "none"} />
      </button>
      <FileThumb file={file} />
      <div className="lg-file-name">{file.name}</div>
      {caption && <div className="lg-file-caption">{caption}</div>}
      <div className="lg-file-meta">
        <span>{formatBytes(file.size_kb)}</span>
        <span>·</span>
        <span>{timeAgo(file.viewed_at || file.created_at)}</span>
      </div>
      {collection && (
        <div style={{ marginTop: 8 }}>
          <span className="lg-tag" style={{ background: "var(--c-sand)", color: "var(--c-ink-soft)" }}>
            {collection.icon} {collection.name}
          </span>
        </div>
      )}
    </div>
  );
}

export function FileRow({ file, collection, onOpen, onToggleStar }) {
  const meta = CATEGORIES[file.category] || CATEGORIES.document;
  const Icon = meta.icon;
  return (
    <div className="lg-file-row" onClick={() => onOpen(file)}>
      <div className="lg-file-row-name">
        <div className="lg-row-icon" style={{ background: meta.bg }}>
          <Icon size={15} color={meta.accent} />
        </div>
        <span>{file.name}</span>
        {file.starred && <Star size={13} color="var(--c-gold)" fill="var(--c-gold)" style={{ flexShrink: 0 }} />}
      </div>
      <div className="lg-mono" style={{ fontSize: 12, color: "var(--c-taupe)" }}>
        {collection ? `${collection.icon} ${collection.name}` : "—"}
      </div>
      <div className="lg-mono" style={{ fontSize: 12, color: "var(--c-taupe)" }}>
        {formatBytes(file.size_kb)}
      </div>
      <div className="lg-mono" style={{ fontSize: 12, color: "var(--c-taupe)" }}>
        {formatDate(file.created_at)}
      </div>
      <button
        className="lg-icon-btn"
        style={{ width: 30, height: 30 }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleStar(file);
        }}
        aria-label="Toggle star"
      >
        <Star size={14} color={file.starred ? "var(--c-gold)" : "var(--c-taupe)"} fill={file.starred ? "var(--c-gold)" : "none"} />
      </button>
    </div>
  );
}

export default function FileList({ files, collectionsById, view, onOpen, onToggleStar, emptyProps }) {
  if (files.length === 0) {
    return (
      <div className="lg-card">
        <EmptyState {...emptyProps} />
      </div>
    );
  }
  if (view === "list") {
    return (
      <div className="lg-card" style={{ overflow: "hidden" }}>
        <div className="lg-file-row" style={{ background: "var(--c-cream)", cursor: "default" }}>
          <div className="lg-eyebrow">Name</div>
          <div className="lg-eyebrow">Collection</div>
          <div className="lg-eyebrow">Size</div>
          <div className="lg-eyebrow">Added</div>
          <div />
        </div>
        {files.map((f) => (
          <FileRow key={f.id} file={f} collection={collectionsById[f.collection_id]} onOpen={onOpen} onToggleStar={onToggleStar} />
        ))}
      </div>
    );
  }
  return (
    <div className="lg-file-grid">
      {files.map((f) => (
        <FileCard key={f.id} file={f} collection={collectionsById[f.collection_id]} onOpen={onOpen} onToggleStar={onToggleStar} />
      ))}
    </div>
  );
}