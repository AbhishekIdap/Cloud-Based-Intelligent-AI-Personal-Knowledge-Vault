"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Folder } from "lucide-react";
import { useCollections } from "../../../lib/hooks";
import { EmptyState } from "../../../components/ui";
import NewCollectionModal from "../../../components/NewCollectionModal";
import { formatBytes } from "../../../lib/constants";

export default function CollectionsPage() {
  const { collections, refresh } = useCollections();
  const [showNew, setShowNew] = useState(false);
  const router = useRouter();

  return (
    <div className="lg-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div className="lg-eyebrow" style={{ marginBottom: 6 }}>
            Collections
          </div>
          <h1 style={{ fontSize: 26 }}>Grouped by what matters to you</h1>
        </div>
        <button className="lg-btn lg-btn-accent" onClick={() => setShowNew(true)}>
          <Plus size={15} /> New collection
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="lg-card">
          <EmptyState
            icon={Folder}
            title="No collections yet"
            body="Collections group related files together — a trip, a project, a season of life."
            action={
              <button className="lg-btn lg-btn-accent" onClick={() => setShowNew(true)} style={{ marginTop: 6 }}>
                <Plus size={14} /> Create your first collection
              </button>
            }
          />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
          {collections.map((c) => (
            <div key={c.id} className="lg-collection-card" onClick={() => router.push(`/collections/${c.id}`)}>
              <div className="lg-collection-icon" style={{ background: `var(--c-${c.color}-tint)` }}>
                {c.icon}
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 4 }}>{c.name}</h3>
              {c.description && (
                <p style={{ fontSize: 12.5, color: "var(--c-taupe)", marginBottom: 12, lineHeight: 1.5 }}>{c.description}</p>
              )}
              <div className="lg-mono" style={{ fontSize: 11.5, color: "var(--c-taupe)", display: "flex", gap: 8 }}>
                <span>{c.file_count ?? 0} items</span>
                <span>·</span>
                <span>{formatBytes(c.total_kb)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && <NewCollectionModal onClose={() => setShowNew(false)} onCreated={() => refresh()} />}
    </div>
  );
}
