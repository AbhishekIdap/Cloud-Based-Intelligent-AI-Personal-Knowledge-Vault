"use client";

import { useEffect, useRef } from "react";
import { api } from "../lib/api";
import { useToast } from "./Toast";
import { playNotificationSound } from "../lib/notificationSound";

const POLL_MS = 15000;

// Mounted once near the top of the app shell (see app/(app)/layout.jsx).
// Reuses the existing Toast system for the popup itself — this component
// only adds: polling, detecting what's new, and sound. The bell dropdown
// in Topbar.jsx already fetches notifications on its own; this dispatches
// "lg:notifications-changed" after each poll so that dropdown can refresh
// itself too, the same way file changes already broadcast "lg:files-changed".
export default function NotificationWatcher() {
  const { push } = useToast();
  const seenIds = useRef(null); // null until the first fetch completes

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      let notifications;
      try {
        ({ notifications } = await api.get("/notifications"));
      } catch {
        return; // network hiccup or logged out — just try again next tick
      }
      if (cancelled) return;

      if (seenIds.current === null) {
        // First load: remember what's already there, but don't pop toasts
        // for notifications that existed before this session started.
        seenIds.current = new Set(notifications.map((n) => n.id));
        return;
      }

      const fresh = notifications.filter((n) => !seenIds.current.has(n.id));
      if (fresh.length > 0) {
        fresh.forEach((n) => {
          push(`${n.title}: ${n.body}`, "info");
          playNotificationSound(n.kind);
          seenIds.current.add(n.id);
        });
        window.dispatchEvent(new CustomEvent("lg:notifications-changed"));
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [push]);

  return null;
}
