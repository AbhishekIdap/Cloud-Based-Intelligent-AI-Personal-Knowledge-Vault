"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Upload, Star, Clock, CalendarClock, Folder, ChevronRight, Sparkles, HardDrive } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";
import { useCollections, useFiles, useReminders, useStorage, useFilesChangedListener } from "../../../lib/hooks";
import { useAppModals } from "../../../components/AppModalsContext";
import { useActiveFile } from "../../../components/ActiveFileContext";
import { FileCard, FileRow } from "../../../components/FileList";
import { EmptyState } from "../../../components/ui";
import { CATEGORIES, CATEGORY_ORDER, formatBytes, formatDate } from "../../../lib/constants";
import { api } from "../../../lib/api";

function StorageDonut() {
  const { storage } = useStorage();
  if (!storage) return null;
  const byCategory = Object.fromEntries((storage.byCategory || []).map((r) => [r.category, Number(r.total_kb)]));
  const data = CATEGORY_ORDER.map((c) => ({ name: CATEGORIES[c].label, value: byCategory[c] || 0, color: CATEGORIES[c].accent })).filter(
    (d) => d.value > 0
  );
  const pct = storage.capKb ? Math.round((storage.usedKb / storage.capKb) * 100) : 0;

  return (
    <div className="lg-card lg-card-pad">
      <div className="lg-section-title" style={{ fontSize: 16, marginBottom: 4 }}>
        <HardDrive size={17} color="var(--c-sage)" /> Storage
      </div>
      <p style={{ fontSize: 12.5, color: "var(--c-taupe)", marginBottom: 6 }}>
        {formatBytes(storage.usedKb)} used of {formatBytes(storage.capKb)}
      </p>
      {data.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--c-taupe)", padding: "20px 0" }}>Nothing uploaded yet.</p>
      ) : (
        <>
          <div style={{ height: 160, position: "relative" }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} dataKey="value" nameKey="name" innerRadius={44} outerRadius={68} paddingAngle={3} stroke="none">
                  {data.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatBytes(v)} contentStyle={{ fontSize: 12, borderRadius: 10, border: "1px solid var(--c-sand)", fontFamily: "var(--font-body)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>{pct}%</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
            {data.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                <span style={{ flex: 1, color: "var(--c-ink-soft)" }}>{d.name}</span>
                <span className="lg-mono" style={{ color: "var(--c-taupe)" }}>
                  {formatBytes(d.value)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { openUpload } = useAppModals();
  const { openFile } = useActiveFile();
  const { collections } = useCollections();
  const { files, refresh: refreshFiles } = useFiles({ hidden: "false", sort: "recent" });
  const { reminders } = useReminders();
  useFilesChangedListener(refreshFiles);

  const collectionsById = useMemo(() => Object.fromEntries(collections.map((c) => [c.id, c])), [collections]);
  const recent = files.slice(0, 6);
  const quickAccess = useMemo(() => {
    const starred = files.filter((f) => f.starred);
    const newest = [...files].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const combined = [...starred, ...newest];
    return Array.from(new Map(combined.map((f) => [f.id, f])).values()).slice(0, 6);
  }, [files]);
  const upcomingReminders = reminders.filter((r) => !r.done).slice(0, 3);

  async function toggleStar(file) {
    await api.patch(`/files/${file.id}`, { starred: !file.starred });
    refreshFiles();
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="lg-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 26, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div className="lg-eyebrow" style={{ marginBottom: 6 }}>
            {formatDate(new Date().toISOString())}
          </div>
          <h1 style={{ fontSize: 30 }}>
            {greeting}, {(user?.name || "").split(" ")[0]}.
          </h1>
        </div>
        <button className="lg-btn lg-btn-accent" onClick={() => openUpload({})}>
          <Upload size={15} /> Upload
        </button>
      </div>

      <div className="lg-card lg-card-pad" style={{ marginBottom: 24, display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div
          className="lg-dropzone"
          style={{ flex: 1, minWidth: 260, padding: "20px 18px" }}
          onClick={() => openUpload({})}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            openUpload({});
          }}
        >
          <Sparkles size={20} color="var(--c-sage)" style={{ marginBottom: 6 }} />
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>Drop anything here</div>
          <div style={{ fontSize: 12.5, color: "var(--c-taupe)", marginTop: 3 }}>
            LifeGraph sorts it into the right category and suggests a collection.
          </div>
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          {[
            { label: "Total items", value: files.length },
            { label: "Collections", value: collections.length },
            { label: "Starred", value: files.filter((f) => f.starred).length },
          ].map((s) => (
            <div key={s.label}>
              <div className="lg-stat-num" style={{ fontSize: 26 }}>
                {s.value}
              </div>
              <div className="lg-eyebrow">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg-dashboard-grid">
        <div>
          <div style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="lg-section-title">
                <Star size={17} color="var(--c-gold)" /> Quick access
              </div>
              <button className="lg-btn lg-btn-ghost lg-btn-sm" onClick={() => router.push("/vault")}>
                View vault <ChevronRight size={13} />
              </button>
            </div>
            {quickAccess.length === 0 ? (
              <div className="lg-card">
                <EmptyState icon={Star} title="Nothing pinned yet" body="Star a few files or upload something new — your most-used items will show up here." />
              </div>
            ) : (
              <div className="lg-file-grid">
                {quickAccess.map((f) => (
                  <FileCard key={f.id} file={f} collection={collectionsById[f.collection_id]} onOpen={openFile} onToggleStar={toggleStar} />
                ))}
              </div>
            )}
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div className="lg-section-title">
                <Clock size={17} color="var(--c-sage)" /> Recently viewed
              </div>
            </div>
            {recent.length === 0 ? (
              <div className="lg-card">
                <EmptyState icon={Clock} title="Your vault is empty" body="Upload your first file to get started." />
              </div>
            ) : (
              <div className="lg-card" style={{ overflow: "hidden" }}>
                {recent.map((f) => (
                  <FileRow key={f.id} file={f} collection={collectionsById[f.collection_id]} onOpen={openFile} onToggleStar={toggleStar} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <StorageDonut />

          <div className="lg-card lg-card-pad">
            <div className="lg-section-title" style={{ fontSize: 16, marginBottom: 12 }}>
              <CalendarClock size={17} color="var(--c-clay)" /> Reminders
            </div>
            {upcomingReminders.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--c-taupe)" }}>Nothing on the horizon.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {upcomingReminders.map((r) => (
                  <div key={r.id} style={{ display: "flex", gap: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--c-clay)", marginTop: 6, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
                      <div className="lg-mono" style={{ fontSize: 11, color: "var(--c-taupe)" }}>
                        {formatDate(r.due_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="lg-btn lg-btn-ghost lg-btn-sm" style={{ marginTop: 14, width: "100%", justifyContent: "center" }} onClick={() => router.push("/settings?tab=reminders")}>
              Manage reminders
            </button>
          </div>

          <div className="lg-card lg-card-pad">
            <div className="lg-section-title" style={{ fontSize: 16, marginBottom: 12 }}>
              <Folder size={17} color="var(--c-rose)" /> Your collections
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {collections.slice(0, 4).map((c) => (
                <div
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "6px 4px", borderRadius: 8 }}
                  onClick={() => router.push(`/collections/${c.id}`)}
                >
                  <span style={{ fontSize: 17 }}>{c.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                  <span className="lg-mono" style={{ fontSize: 11, color: "var(--c-taupe)" }}>
                    {c.file_count ?? 0}
                  </span>
                </div>
              ))}
            </div>
            <button className="lg-btn lg-btn-ghost lg-btn-sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} onClick={() => router.push("/collections")}>
              See all collections
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
