"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { User, Bell, CalendarClock, HardDrive, Shield, EyeOff, Download, Plus, Trash2, Check } from "lucide-react";
import { useAuth } from "../../../lib/auth-context";
import { useReminders, useStorage, useFiles } from "../../../lib/hooks";
import { api } from "../../../lib/api";
import { useToast } from "../../../components/Toast";
import { useActiveFile } from "../../../components/ActiveFileContext";
import { Switch, Avatar, CategoryIcon, EmptyState } from "../../../components/ui";
import { CATEGORIES, CATEGORY_ORDER, cx, formatBytes, formatDate } from "../../../lib/constants";

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "reminders", label: "Reminders", icon: CalendarClock },
  { key: "hidden", label: "Hidden files", icon: EyeOff },
  { key: "storage", label: "Storage", icon: HardDrive },
  { key: "security", label: "Security", icon: Shield },
];

function ProfileTab() {
  const { user, refresh } = useAuth();
  const { push } = useToast();
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  async function saveName() {
    setSaving(true);
    try {
      await api.patch("/users/me", { name });
      await refresh();
      push("Profile updated.");
    } finally {
      setSaving(false);
    }
  }

  async function setTheme(theme) {
    // Applies immediately, no separate save step — matches the original
    // prototype's updateSettings({ theme }) behavior.
    await api.patch("/users/me", { theme });
    await refresh();
  }

  return (
    <div className="lg-card lg-card-pad">
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 22 }}>
        <Avatar initials={user?.avatar_initials} color={user?.avatar_color} size={56} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{user?.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--c-taupe)" }}>{user?.email}</div>
        </div>
      </div>

      <div className="lg-field">
        <label className="lg-label">Name</label>
        <input className="lg-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="lg-field">
        <label className="lg-label">Theme</label>
        <div style={{ display: "flex", gap: 8 }}>
          {["light", "dark"].map((t) => (
            <button key={t} className={cx("lg-chip", user?.theme === t && "active")} onClick={() => setTheme(t)} style={{ textTransform: "capitalize" }}>
              {t}
            </button>
          ))}
        </div>
        <div className="lg-help">Applies immediately.</div>
      </div>

      <button className="lg-btn lg-btn-accent" onClick={saveName} disabled={saving || name === user?.name}>
        <Check size={14} /> Save name
      </button>
    </div>
  );
}

function NotificationsTab() {
  const [prefs, setPrefs] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    api.get("/users/me/notification-preferences").then(({ preferences }) => setPrefs(preferences));
  }, []);

  async function toggle(key) {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const { preferences } = await api.patch("/users/me/notification-preferences", { [key]: next[key] });
    setPrefs(preferences);
    push("Preferences saved.");
  }

  if (!prefs) return null;

  const rows = [
    { key: "uploads", label: "Uploads", body: "When a file finishes uploading to your vault." },
    { key: "reminders", label: "Reminders", body: "When a reminder is created or due." },
    { key: "collection_activity", label: "Collection activity", body: "Changes to collections you've made." },
    { key: "security", label: "Security", body: "Logins, password changes, and account events." },
    { key: "weekly_digest", label: "Weekly digest", body: "A weekly summary of what's new in your vault." },
  ];

  return (
    <div className="lg-card lg-card-pad">
      {rows.map((r, i) => (
        <div key={r.key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: i > 0 ? "1px solid var(--c-sand)" : "none" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{r.label}</div>
            <div style={{ fontSize: 12.5, color: "var(--c-taupe)" }}>{r.body}</div>
          </div>
          <Switch on={prefs[r.key]} onToggle={() => toggle(r.key)} />
        </div>
      ))}
    </div>
  );
}

function RemindersTab() {
  const { reminders, refresh } = useReminders();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const { push } = useToast();

  async function add() {
    if (!title.trim() || !dueAt) return;
    await api.post("/reminders", { title: title.trim(), dueAt: new Date(dueAt).toISOString() });
    setTitle("");
    setDueAt("");
    refresh();
    push("Reminder added.");
  }

  async function toggleDone(r) {
    await api.patch(`/reminders/${r.id}`, { done: !r.done });
    refresh();
  }

  async function remove(r) {
    await api.delete(`/reminders/${r.id}`);
    refresh();
  }

  return (
    <div className="lg-card lg-card-pad">
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <input className="lg-input" style={{ flex: 1, minWidth: 160 }} placeholder="Reminder title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="lg-input" style={{ width: 190 }} type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        <button className="lg-btn lg-btn-accent" onClick={add} disabled={!title.trim() || !dueAt}>
          <Plus size={14} /> Add
        </button>
      </div>

      {reminders.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--c-taupe)" }}>No reminders yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {reminders.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid var(--c-sand)" }}>
              <input type="checkbox" checked={r.done} onChange={() => toggleDone(r)} style={{ width: 16, height: 16, accentColor: "var(--c-sage)" }} />
              <div style={{ flex: 1, textDecoration: r.done ? "line-through" : "none", opacity: r.done ? 0.55 : 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>{r.title}</div>
                <div className="lg-mono" style={{ fontSize: 11, color: "var(--c-taupe)" }}>
                  {formatDate(r.due_at)}
                </div>
              </div>
              <button className="lg-icon-btn" style={{ width: 30, height: 30 }} onClick={() => remove(r)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StorageTab() {
  const { storage } = useStorage();
  const { push } = useToast();

  async function exportData() {
    const data = await api.get("/users/me/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "lifegraph-export.json";
    a.click();
    URL.revokeObjectURL(url);
    push("Export downloaded.");
  }

  if (!storage) return null;
  const byCategory = Object.fromEntries((storage.byCategory || []).map((r) => [r.category, r]));
  const pct = storage.capKb ? Math.round((storage.usedKb / storage.capKb) * 100) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="lg-card lg-card-pad">
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            {formatBytes(storage.usedKb)} of {formatBytes(storage.capKb)} used
          </span>
          <span className="lg-mono" style={{ fontSize: 12, color: "var(--c-taupe)" }}>
            {pct}%
          </span>
        </div>
        <div className="lg-storage-track" style={{ height: 8 }}>
          <div className="lg-storage-fill" style={{ width: `${pct}%` }} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 18 }}>
          {CATEGORY_ORDER.map((c) => {
            const row = byCategory[c];
            if (!row) return null;
            return (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORIES[c].accent }} />
                <span style={{ flex: 1 }}>{CATEGORIES[c].label}</span>
                <span className="lg-mono" style={{ color: "var(--c-taupe)" }}>
                  {row.file_count} items · {formatBytes(row.total_kb)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="lg-card lg-card-pad">
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Export your data</div>
        <p style={{ fontSize: 12.5, color: "var(--c-taupe)", marginBottom: 14 }}>Download a JSON copy of your collections, file metadata, and reminders.</p>
        <button className="lg-btn lg-btn-ghost" onClick={exportData}>
          <Download size={14} /> Export as JSON
        </button>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const { push } = useToast();

  async function changePassword() {
    setError("");
    try {
      await api.post("/users/me/password", { currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      push("Password updated.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="lg-card lg-card-pad">
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Change password</div>
      {error && <div className="lg-auth-error">{error}</div>}
      <div className="lg-field">
        <label className="lg-label">Current password</label>
        <input className="lg-input" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      <div className="lg-field">
        <label className="lg-label">New password</label>
        <input className="lg-input" type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
      </div>
      <button className="lg-btn lg-btn-primary" onClick={changePassword} disabled={!currentPassword || newPassword.length < 8}>
        Update password
      </button>
    </div>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState(searchParams.get("tab") || "profile");

  return (
    <div className="lg-fade-in">
      <div style={{ marginBottom: 22 }}>
        <div className="lg-eyebrow" style={{ marginBottom: 6 }}>
          Settings
        </div>
        <h1 style={{ fontSize: 26 }}>Your account</h1>
      </div>

      <div className="lg-settings-layout">
        <div className="lg-card lg-card-pad" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} className={cx("lg-settings-tab", tab === t.key && "active")} onClick={() => setTab(t.key)}>
                <Icon size={15} />
                {t.label}
              </button>
            );
          })}
        </div>

        <div>
          {tab === "profile" && <ProfileTab />}
          {tab === "notifications" && <NotificationsTab />}
          {tab === "reminders" && <RemindersTab />}
          {tab === "hidden" && <HiddenFilesTab />}
          {tab === "storage" && <StorageTab />}
          {tab === "security" && <SecurityTab />}
        </div>
      </div>
    </div>
  );
}

function HiddenFilesTab() {
  const { user, refresh } = useAuth();
  const { files, refresh: refreshFiles } = useFiles({ hidden: "true" });
  const { openFile } = useActiveFile();
  const { push } = useToast();

  async function toggleShowHidden() {
    await api.patch("/users/me", { show_hidden: !user.show_hidden });
    await refresh();
  }

  async function unhide(file) {
    await api.patch(`/files/${file.id}`, { hidden: false });
    refreshFiles();
    push(`"${file.name}" is no longer hidden.`);
  }

  return (
    <div className="lg-card lg-card-pad">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 16, borderBottom: "1px solid var(--c-sand)", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500 }}>Show hidden files in Vault</div>
          <div style={{ fontSize: 12.5, color: "var(--c-taupe)" }}>Mix hidden items back into your main Vault list.</div>
        </div>
        <Switch on={!!user?.show_hidden} onToggle={toggleShowHidden} />
      </div>

      {files.length === 0 ? (
        <EmptyState icon={EyeOff} title="Nothing hidden" body="Hide sensitive files from a file's detail view — they'll show up here." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px", borderRadius: 8, cursor: "pointer" }} onClick={() => openFile(f)}>
              <CategoryIcon category={f.category} size={16} />
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</div>
              <button
                className="lg-btn lg-btn-ghost lg-btn-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  unhide(f);
                }}
              >
                Unhide
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}
