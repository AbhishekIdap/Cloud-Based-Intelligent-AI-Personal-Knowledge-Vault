"use client";

import { createContext, useContext, useState, useCallback } from "react";

const Ctx = createContext(null);

export function AppModalsProvider({ children }) {
  const [uploadState, setUploadState] = useState(null); // { collectionId } | null
  const [noteState, setNoteState] = useState(null); // { collectionId } | null
  const [newCollectionState, setNewCollectionState] = useState(null); // { onCreated } | null

  const openUpload = useCallback((opts = {}) => setUploadState(opts), []);
  const closeUpload = useCallback(() => setUploadState(null), []);
  const openNewNote = useCallback((opts = {}) => setNoteState(opts), []);
  const closeNewNote = useCallback(() => setNoteState(null), []);
  const openNewCollection = useCallback((opts = {}) => setNewCollectionState(opts), []);
  const closeNewCollection = useCallback(() => setNewCollectionState(null), []);

  return (
    <Ctx.Provider
      value={{
        uploadState,
        openUpload,
        closeUpload,
        noteState,
        openNewNote,
        closeNewNote,
        newCollectionState,
        openNewCollection,
        closeNewCollection,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAppModals() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppModals must be used within AppModalsProvider");
  return ctx;
}
