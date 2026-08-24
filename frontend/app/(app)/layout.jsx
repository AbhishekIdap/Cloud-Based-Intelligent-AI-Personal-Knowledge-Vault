"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { ToastProvider } from "../../components/Toast";
import { AppModalsProvider, useAppModals } from "../../components/AppModalsContext";
import { ActiveFileProvider, useActiveFile } from "../../components/ActiveFileContext";
import Sidebar from "../../components/Sidebar";
import Topbar from "../../components/Topbar";
import UploadModal from "../../components/UploadModal";
import NewNoteModal from "../../components/NewNoteModal";
import FileDetailModal from "../../components/FileDetailModal";
import NotificationWatcher from "../../components/NotificationWatcher";
import { useCollections } from "../../lib/hooks";

function AppShellInner({ children }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { uploadState, closeUpload, noteState, closeNewNote } = useAppModals();
  const { activeFile, closeFile, setActiveFile, openFile } = useActiveFile();
  const { collections, refresh: refreshCollections } = useCollections();

  return (
    <div className="lg-shell">
      <NotificationWatcher />
      <Sidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <div className="lg-main">
        <Topbar onMenuClick={() => setMobileNavOpen(true)} onOpenFile={openFile} />
        <div className="lg-page">{children}</div>
      </div>

      {uploadState && (
        <UploadModal
          onClose={closeUpload}
          collections={collections}
          defaultCollectionId={uploadState.collectionId}
          onUploaded={() => {
            refreshCollections();
            window.dispatchEvent(new CustomEvent("lg:files-changed"));
          }}
        />
      )}

      {noteState && (
        <NewNoteModal
          onClose={closeNewNote}
          collections={collections}
          defaultCollectionId={noteState.collectionId}
          onCreated={() => {
            refreshCollections();
            window.dispatchEvent(new CustomEvent("lg:files-changed"));
          }}
        />
      )}

      {activeFile && (
        <FileDetailModal
          file={activeFile}
          collections={collections}
          onClose={closeFile}
          onChanged={(updated) => {
            setActiveFile(updated);
            window.dispatchEvent(new CustomEvent("lg:files-changed"));
          }}
          onDeleted={() => {
            closeFile();
            window.dispatchEvent(new CustomEvent("lg:files-changed"));
          }}
        />
      )}
    </div>
  );
}

export default function AppLayout({ children }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--c-taupe)" }}>
        <Loader2 size={18} className="lg-spin" /> Loading your vault…
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppModalsProvider>
        <ActiveFileProvider>
          <AppShellInner>{children}</AppShellInner>
        </ActiveFileProvider>
      </AppModalsProvider>
    </ToastProvider>
  );
}
