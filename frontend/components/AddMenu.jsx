"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, StickyNote } from "lucide-react";
import { useAppModals } from "./AppModalsContext";

function useOutsideClick(ref, onOutside) {
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

/**
 * Renders `trigger` (any button/nav-item) and, on click, a small popover
 * with "Upload file" and "New note" — instead of jumping straight into the
 * upload modal like a single "Create"/"Upload" button used to.
 */
export default function AddMenu({ trigger, collectionId = null, align = "left", fullWidth = false }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { openUpload, openNewNote } = useAppModals();
  useOutsideClick(wrapRef, () => setOpen(false));

  return (
    <div className="lg-add-menu-wrap" style={fullWidth ? { display: "flex", width: "100%" } : undefined} ref={wrapRef}>
      {trigger(() => setOpen((o) => !o), open)}
      {open && (
        <div className="lg-add-menu" style={align === "right" ? { left: "auto", right: 0 } : undefined}>
          <button
            className="lg-add-menu-item"
            onClick={() => {
              setOpen(false);
              openUpload({ collectionId });
            }}
          >
            <Upload size={15} /> Upload file
          </button>
          <button
            className="lg-add-menu-item"
            onClick={() => {
              setOpen(false);
              openNewNote({ collectionId });
            }}
          >
            <StickyNote size={15} /> New note
          </button>
        </div>
      )}
    </div>
  );
}
