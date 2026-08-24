"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Upload, Trash2, Pencil, Loader2 } from "lucide-react";
import { api } from "../../../../lib/api";
import { useFiles, useFilesChangedListener, useCollections } from "../../../../lib/hooks";
import { useAppModals } from "../../../../components/AppModalsContext";
import { useActiveFile } from "../../../../components/ActiveFileContext";
import FileList, { FilterBar } from "../../../../components/FileList";
import { ConfirmModal } from "../../../../components/ui";
import { formatBytes } from "../../../../lib/constants";

export default function CollectionDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("grid");

  const { collections: allCollections } = useCollections();
  const { openUpload } = useAppModals();
  const { openFile } = useActiveFile();

  const { files, refresh } = useFiles({ collectionId: id, category: category === "all" ? undefined : category, q: query || undefined, sort });
  useFilesChangedListener(refresh);
  useFilesChangedListener(() => loadCollection());

  async function loadCollection() {
    try {
      const { collection } = await api.get(`/collections/${id}`);
      setCollection(collection);
      setNameDraft(collection.name);
    } catch {
      router.replace("/collections");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCollection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveName() {
    const { collection: updated } = await api.patch(`/collections/${id}`, { name: nameDraft });
    setCollection(updated);
    setEditing(false);
  }

  async function handleDelete() {
    await api.delete(`/collections/${id}`);
    router.push("/collections");
  }

  async function toggleStar(file) {
    await api.patch(`/files/${file.id}`, { starred: !file.starred });
    refresh();
  }

  const collectionsById = collection ? { [collection.id]: collection } : {};

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, color: "var(--c-taupe)" }}>
        <Loader2 size={20} className="lg-spin" />
      </div>
    );
  }
  if (!collection) return null;

  return (
    <div className="lg-fade-in">
      <button className="lg-btn lg-btn-ghost lg-btn-sm" onClick={() => router.push("/collections")} style={{ marginBottom: 16 }}>
        <ArrowLeft size={13} /> All collections
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 26, flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <div className="lg-collection-icon" style={{ background: `var(--c-${collection.color}-tint)`, marginBottom: 0, width: 54, height: 54, fontSize: 26 }}>
            {collection.icon}
          </div>
          <div>
            {editing ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input className="lg-input" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus />
                <button className="lg-btn lg-btn-accent lg-btn-sm" onClick={saveName}>
                  Save
                </button>
              </div>
            ) : (
              <h1 style={{ fontSize: 26, display: "flex", alignItems: "center", gap: 10 }}>
                {collection.name}
                <button className="lg-icon-btn" style={{ width: 30, height: 30 }} onClick={() => setEditing(true)}>
                  <Pencil size={13} />
                </button>
              </h1>
            )}
            <p style={{ fontSize: 12.5, color: "var(--c-taupe)", marginTop: 4 }}>
              {files.length} item{files.length !== 1 ? "s" : ""} · {formatBytes(files.reduce((s, f) => s + Number(f.size_kb), 0))}
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="lg-btn lg-btn-danger" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} /> Delete
          </button>
          <button className="lg-btn lg-btn-accent" onClick={() => openUpload({ collectionId: collection.id })}>
            <Upload size={14} /> Add files
          </button>
        </div>
      </div>

      <FilterBar query={query} onQuery={setQuery} category={category} onCategory={setCategory} sort={sort} onSort={setSort} view={view} onView={setView} />

      <FileList
        files={files}
        collectionsById={collectionsById}
        view={view}
        onOpen={openFile}
        onToggleStar={toggleStar}
        emptyProps={{
          title: "Nothing in this collection yet",
          body: "Add files directly, or upload elsewhere and move them here from the file details panel.",
          action: (
            <button className="lg-btn lg-btn-accent" onClick={() => openUpload({ collectionId: collection.id })} style={{ marginTop: 6 }}>
              <Upload size={14} /> Add files
            </button>
          ),
        }}
      />

      {confirmDelete && (
        <ConfirmModal
          title="Delete this collection?"
          body={`"${collection.name}" will be deleted. Files inside it aren't deleted — they'll just lose this collection.`}
          confirmLabel="Delete collection"
          danger
          onConfirm={handleDelete}
          onClose={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}
