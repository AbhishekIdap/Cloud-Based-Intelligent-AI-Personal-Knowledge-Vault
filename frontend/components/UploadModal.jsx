"use client";

import { useRef, useState } from "react";
import { Upload, Check, X, Sparkles, Loader2 } from "lucide-react";
import { Modal, CategoryIcon } from "./ui";
import { CATEGORIES, CATEGORY_ORDER, categorizeFile, cx } from "../lib/constants";
import { api } from "../lib/api";
import { useToast } from "./Toast";

let __tempId = 0;
function tempId() {
  __tempId += 1;
  return `stage_${__tempId}`;
}

function suggestCollection(fileName, collections) {
  const name = (fileName || "").toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const c of collections) {
    const terms = [c.name, ...(c.keywords || [])].join(" ").toLowerCase().split(/[\s,]+/).filter(Boolean);
    let score = 0;
    for (const t of terms) if (t.length > 2 && name.includes(t)) score += t.length;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore > 0 ? best : null;
}

export default function UploadModal({ onClose, collections, defaultCollectionId = null, onUploaded }) {
  const [staged, setStaged] = useState([]); // {tempId, file, name, category, collectionId, suggested, status}
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const { push } = useToast();

  function handleFiles(fileList) {
    const arr = Array.from(fileList);
    const entries = arr.map((file) => {
      const category = categorizeFile(file);
      const suggested = defaultCollectionId
        ? collections.find((c) => c.id === defaultCollectionId)
        : suggestCollection(file.name, collections);
      return {
        tempId: tempId(),
        file,
        name: file.name,
        category,
        collectionId: suggested ? suggested.id : defaultCollectionId,
        suggested: !!suggested && !defaultCollectionId,
        status: "staged",
      };
    });
    setStaged((s) => [...s, ...entries]);
  }

  function updateStaged(id, patch) {
    setStaged((s) => s.map((it) => (it.tempId === id ? { ...it, ...patch } : it)));
  }
  function removeStaged(id) {
    setStaged((s) => s.filter((it) => it.tempId !== id));
  }

  async function confirmAll() {
    if (staged.length === 0) return;
    setStaged((s) => s.map((it) => ({ ...it, status: "uploading" })));

    const results = await Promise.allSettled(
      staged.map((it) =>
        api.uploadFile(it.file, { collectionId: it.collectionId, category: it.category, description: it.description }).then((r) => {
          updateStaged(it.tempId, { status: "done" });
          return r;
        })
      )
    );

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - succeeded;

    if (succeeded > 0) push(`Added ${succeeded} file${succeeded !== 1 ? "s" : ""} to your vault.`);
    if (failed > 0) push(`${failed} upload${failed !== 1 ? "s" : ""} failed — try again.`, "error");

    onUploaded?.();
    if (failed === 0) onClose();
    else setStaged((s) => s.filter((it, i) => results[i].status !== "fulfilled"));
  }

  const anyUploading = staged.some((it) => it.status === "uploading");

  return (
    <Modal
      title="Upload to LifeGraph"
      onClose={onClose}
      wide
      footer={
        <>
          <button className="lg-btn lg-btn-ghost" onClick={onClose} disabled={anyUploading}>
            Cancel
          </button>
          <button className="lg-btn lg-btn-accent" disabled={staged.length === 0 || anyUploading} onClick={confirmAll}>
            {anyUploading ? <Loader2 size={15} className="lg-spin" /> : <Check size={15} />}
            {anyUploading ? "Uploading…" : `Add ${staged.length > 0 ? staged.length : ""} to vault`}
          </button>
        </>
      }
    >
      <div
        className={cx("lg-dropzone", dragOver && "drag-over")}
        onClick={() => inputRef.current && inputRef.current.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <Upload size={22} color="var(--c-sage)" style={{ marginBottom: 8 }} />
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>Drop files here, or click to browse</div>
        <div style={{ fontSize: 12.5, color: "var(--c-taupe)", marginTop: 4 }}>
          LifeGraph sorts each file into a category automatically — you can adjust before saving.
        </div>
      </div>

      {staged.length > 0 && (
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {staged.map((it) => (
            <div key={it.tempId} className="lg-card" style={{ padding: 12, display: "flex", gap: 12, alignItems: "center" }}>
              <div className="lg-row-icon" style={{ width: 40, height: 40, background: CATEGORIES[it.category].bg }}>
                {it.status === "uploading" ? <Loader2 size={16} className="lg-spin" /> : <CategoryIcon category={it.category} size={18} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {it.name}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <select
                    className="lg-input lg-mono"
                    style={{ width: "auto", padding: "5px 8px", fontSize: 11.5 }}
                    value={it.category}
                    onChange={(e) => updateStaged(it.tempId, { category: e.target.value })}
                  >
                    {CATEGORY_ORDER.map((c) => (
                      <option key={c} value={c}>
                        {CATEGORIES[c].label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="lg-input lg-mono"
                    style={{ width: "auto", padding: "5px 8px", fontSize: 11.5 }}
                    value={it.collectionId || ""}
                    onChange={(e) => updateStaged(it.tempId, { collectionId: e.target.value || null })}
                  >
                    <option value="">No collection</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                {it.suggested && (
                  <div style={{ fontSize: 11, color: "var(--c-sage)", marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
                    <Sparkles size={11} /> Suggested match
                  </div>
                )}
                <textarea
                  className="lg-input"
                  placeholder="Add a note about this file so it's easier to find later (optional) — e.g. &quot;Feb electricity bill, ₹2,340&quot;"
                  rows={2}
                  style={{ marginTop: 8, fontSize: 12.5, resize: "vertical" }}
                  value={it.description || ""}
                  onChange={(e) => updateStaged(it.tempId, { description: e.target.value })}
                />
                <div style={{ fontSize: 10.5, color: "var(--c-taupe)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <Sparkles size={10} /> LifeGraph's AI will also read this file after upload to make it searchable — a note here just helps it along.
                </div>
              </div>
              <button className="lg-icon-btn" style={{ width: 30, height: 30 }} onClick={() => removeStaged(it.tempId)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
