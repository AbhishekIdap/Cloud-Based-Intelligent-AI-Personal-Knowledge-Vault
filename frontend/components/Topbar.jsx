"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, Menu, Sparkle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useNotifications } from "../lib/hooks";
import { timeAgo } from "../lib/constants";
import { Avatar, CategoryIcon } from "./ui";

function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

export default function Topbar({ onMenuClick, onOpenFile }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { notifications, refresh: refreshNotifs } = useNotifications();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({ files: [], collections: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  useOutsideClick(searchRef, () => setSearchOpen(false));
  useOutsideClick(notifRef, () => setNotifOpen(false));
  useOutsideClick(profileRef, () => setProfileOpen(false));

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults({ files: [], collections: [] });
      return;
    }
    const t = setTimeout(async () => {
      const [{ files }, { collections }] = await Promise.all([
        api.get(`/files?q=${encodeURIComponent(term)}`),
        api.get("/collections"),
      ]);
      const lower = term.toLowerCase();
      setResults({
        files: files.slice(0, 6),
        collections: collections.filter((c) => c.name.toLowerCase().includes(lower)).slice(0, 4),
      });
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  // Keeps the bell badge and dropdown in sync when NotificationWatcher
  // (polling in the background) spots something new — same pattern as the
  // existing "lg:files-changed" event used elsewhere in the app.
  useEffect(() => {
    function handler() {
      refreshNotifs();
    }
    window.addEventListener("lg:notifications-changed", handler);
    return () => window.removeEventListener("lg:notifications-changed", handler);
  }, [refreshNotifs]);

  const unread = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    await api.post("/notifications/read-all");
    refreshNotifs();
  }

  return (
    <div className="lg-topbar">
      <button className="lg-icon-btn lg-hamburger" onClick={onMenuClick} aria-label="Menu">
        <Menu size={19} />
      </button>
      <div className="lg-topbar-brand">
        <div className="lg-brand-mark" style={{ width: 28, height: 28 }}>
          <Sparkle size={13} color="#fff" />
        </div>
      </div>

      <div className="lg-search-wrap" ref={searchRef}>
        <div className="lg-search">
          <Search size={16} color="var(--c-taupe)" />
          <input
            placeholder="Search files, collections, notes…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
            }}
            onFocus={() => setSearchOpen(true)}
          />
        </div>
        {searchOpen && query.trim() && (
          <div className="lg-search-results">
            {results.collections.length === 0 && results.files.length === 0 && (
              <div style={{ padding: 14, fontSize: 13, color: "var(--c-taupe)" }}>No matches yet.</div>
            )}
            {results.collections.length > 0 && (
              <>
                <div className="lg-search-group-label lg-eyebrow">Collections</div>
                {results.collections.map((c) => (
                  <div
                    key={c.id}
                    className="lg-search-result"
                    onClick={() => {
                      router.push(`/collections/${c.id}`);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <span>{c.icon}</span>
                    <span style={{ fontSize: 13.5 }}>{c.name}</span>
                  </div>
                ))}
              </>
            )}
            {results.files.length > 0 && (
              <>
                <div className="lg-search-group-label lg-eyebrow">Files</div>
                {results.files.map((f) => (
                  <div
                    key={f.id}
                    className="lg-search-result"
                    onClick={() => {
                      onOpenFile?.(f);
                      setSearchOpen(false);
                      setQuery("");
                    }}
                  >
                    <CategoryIcon category={f.category} size={16} />
                    <span style={{ fontSize: 13.5 }}>{f.name}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <div className="lg-topbar-spacer" />

      <div style={{ position: "relative" }} ref={notifRef}>
        <button className="lg-icon-btn" onClick={() => setNotifOpen((v) => !v)} aria-label="Notifications">
          <Bell size={18} />
          {unread > 0 && <span className="lg-badge-dot" />}
        </button>
        {notifOpen && (
          <div className="lg-dropdown">
            <div className="lg-dropdown-header">
              <strong style={{ fontSize: 14 }}>Notifications</strong>
              {unread > 0 && (
                <button className="lg-btn lg-btn-ghost lg-btn-sm" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="lg-dropdown-list">
              {notifications.length === 0 && (
                <div style={{ padding: 16, fontSize: 13, color: "var(--c-taupe)" }}>You're all caught up.</div>
              )}
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="lg-notif-item"
                  onClick={async () => {
                    if (!n.read) {
                      await api.post(`/notifications/${n.id}/read`);
                      refreshNotifs();
                    }
                  }}
                >
                  {!n.read && <span className="lg-notif-dot" />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{n.title}</div>
                    <div style={{ fontSize: 12.5, color: "var(--c-taupe)" }}>{n.body}</div>
                    <div style={{ fontSize: 11, color: "var(--c-taupe)", marginTop: 3 }} className="lg-mono">
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ position: "relative" }} ref={profileRef}>
        <button className="lg-icon-btn" onClick={() => setProfileOpen((v) => !v)} aria-label="Profile" style={{ padding: 0 }}>
          {user && <Avatar initials={user.avatar_initials} color={user.avatar_color} size={34} />}
        </button>
        {profileOpen && (
          <div className="lg-dropdown" style={{ width: 200 }}>
            <div className="lg-profile-menu-item" onClick={() => router.push("/settings")}>
              Settings
            </div>
            <div className="lg-profile-menu-item" onClick={logout} style={{ color: "var(--c-danger)" }}>
              Log out
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
