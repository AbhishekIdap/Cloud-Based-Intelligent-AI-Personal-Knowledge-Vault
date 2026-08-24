"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export function useFilesChangedListener(refresh) {
  useEffect(() => {
    function handler() {
      refresh();
    }
    window.addEventListener("lg:files-changed", handler);
    return () => window.removeEventListener("lg:files-changed", handler);
  }, [refresh]);
}

export function useCollections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { collections } = await api.get("/collections");
    setCollections(collections);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { collections, loading, refresh };
}

export function useFiles(params = {}) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(params);

  const refresh = useCallback(async () => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
    ).toString();
    const { files } = await api.get(`/files${qs ? `?${qs}` : ""}`);
    setFiles(files);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { files, loading, refresh, setFiles };
}

export function useReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { reminders } = await api.get("/reminders");
    setReminders(reminders);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { reminders, loading, refresh };
}

export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { notifications } = await api.get("/notifications");
    setNotifications(notifications);
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  return { notifications, loading, refresh };
}

export function useStorage() {
  const [storage, setStorage] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get("/users/me/storage");
      setStorage(data);
    } catch (err) {
      // Swallow — the sidebar panel just keeps showing its last known value
      // (or its 0/cap default) rather than throwing an unhandled rejection.
      console.error("Failed to load storage usage:", err.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // This was the actual bug behind "storage shows a static value": every
  // other piece of file-derived state (the vault list, dashboard, a
  // collection's contents) listens for "lg:files-changed" and refetches,
  // but this hook only ever fetched once on mount. Upload or delete a file
  // and the sidebar number never moved. Wiring the listener in here, once,
  // fixes it everywhere useStorage() is used (currently just Sidebar).
  useFilesChangedListener(refresh);

  return { storage, refresh };
}
