"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { api } from "../lib/api";

const Ctx = createContext(null);

export function ActiveFileProvider({ children }) {
  const [activeFile, setActiveFile] = useState(null);

  const openFile = useCallback((file) => {
    setActiveFile(file);
    api.post(`/files/${file.id}/view`).catch(() => {});
  }, []);
  const closeFile = useCallback(() => setActiveFile(null), []);

  return <Ctx.Provider value={{ activeFile, openFile, closeFile, setActiveFile }}>{children}</Ctx.Provider>;
}

export function useActiveFile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useActiveFile must be used within ActiveFileProvider");
  return ctx;
}
