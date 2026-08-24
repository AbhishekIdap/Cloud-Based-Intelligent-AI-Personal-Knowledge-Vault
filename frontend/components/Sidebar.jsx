"use client";

import { usePathname, useRouter } from "next/navigation";
import { Home, Archive, Plus, Folder, Bot, Settings as SettingsIcon, LogOut, Sparkle, HardDrive } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { useStorage } from "../lib/hooks";
import { formatBytes, cx } from "../lib/constants";
import { Avatar } from "./ui";
import AddMenu from "./AddMenu";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: Home, href: "/dashboard" },
  { key: "vault", label: "Vault", icon: Archive, href: "/vault" },
  { key: "create", label: "Create", icon: Plus, href: null },
  { key: "collections", label: "Collections", icon: Folder, href: "/collections" },
  { key: "ai", label: "AI Assistant", icon: Bot, href: "/ai" },
  { key: "settings", label: "Settings", icon: SettingsIcon, href: "/settings" },
];

export default function Sidebar({ mobileOpen, onCloseMobile }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { storage } = useStorage();

  const usedKb = storage?.usedKb || 0;
  const capKb = storage?.capKb || user?.storage_cap_kb || 1;
  const pct = Math.min(100, (usedKb / capKb) * 100);

  function go(item) {
    if (item.href) router.push(item.href);
    onCloseMobile?.();
  }

  return (
    <>
      {mobileOpen && <div className="lg-mobile-backdrop" onClick={onCloseMobile} />}
      <aside className={cx("lg-sidebar", mobileOpen && "mobile-open")}>
        <div className="lg-brand">
          <div className="lg-brand-mark">
            <Sparkle size={17} color="#fff" />
          </div>
          <span className="lg-brand-name">LifeGraph</span>
        </div>

        <nav className="lg-nav">
          <div className="lg-nav-thread" />
          {NAV_ITEMS.map((item) => {
            const active = item.href && pathname?.startsWith(item.href);
            const Icon = item.icon;

            if (item.key === "create") {
              return (
                <AddMenu
                  key={item.key}
                  fullWidth
                  trigger={(toggle, open) => (
                    <button className={cx("lg-nav-item", open && "active")} onClick={toggle}>
                      <span className="lg-nav-dot" />
                      <Icon size={17} />
                      {item.label}
                    </button>
                  )}
                />
              );
            }

            return (
              <button key={item.key} className={cx("lg-nav-item", active && "active")} onClick={() => go(item)}>
                <span className="lg-nav-dot" />
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="lg-sidebar-footer">
          <div className="lg-storage-mini">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="lg-eyebrow">Storage</span>
              <HardDrive size={13} color="var(--c-taupe)" />
            </div>
            <div className="lg-storage-track">
              <div className="lg-storage-fill" style={{ width: `${pct}%` }} />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--c-taupe)", marginTop: 7 }} className="lg-mono">
              {formatBytes(usedKb)} of {formatBytes(capKb)}
            </div>
          </div>

          {user && (
            <div className="lg-user-row" style={{ cursor: "pointer" }} onClick={() => go({ href: "/settings" })}>
              <Avatar initials={user.avatar_initials} color={user.avatar_color} size={32} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--c-taupe)" }}>{user.plan}</div>
              </div>
            </div>
          )}
          <button className="lg-nav-item" onClick={logout} style={{ color: "var(--c-danger)" }}>
            <span style={{ width: 8 }} />
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}
