"use client";

import { useMemo, useState } from "react";
import { Archive, Plus, Star, EyeOff } from "lucide-react";
import { useCollections, useFiles, useFilesChangedListener } from "../../../lib/hooks";
import { useActiveFile } from "../../../components/ActiveFileContext";
import { useAuth } from "../../../lib/auth-context";
import FileList, { FilterBar } from "../../../components/FileList";
import AddMenu from "../../../components/AddMenu";
import { api } from "../../../lib/api";
import { cx } from "../../../lib/constants";

export default function VaultPage() {
  const [panel, setPanel] = useState("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("recent");
  const [view, setView] = useState("grid");

  const { user } = useAuth();
  const { collections } = useCollections();
  const { openFile } = useActiveFile();

  const PANELS = [
    { key: "all", label: "All files", icon: Archive, params: user?.show_hidden ? { includeHidden: "true" } : {} },
    { key: "starred", label: "Starred", icon: Star, params: { starred: "true" } },
    { key: "hidden", label: "Hidden", icon: EyeOff, params: { hidden: "true" } },
  ];

  const panelParams = PANELS.find((p) => p.key === panel).params;
  const params = useMemo(
    () => ({
      ...panelParams,
      category: category === "all" ? undefined : category,
      q: query || undefined,
      sort,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panel, category, query, sort, user?.show_hidden]
  );

  const { files, refresh } = useFiles(params);
  useFilesChangedListener(refresh);

  const collectionsById = useMemo(() => Object.fromEntries(collections.map((c) => [c.id, c])), [collections]);

  async function toggleStar(file) {
    await api.patch(`/files/${file.id}`, { starred: !file.starred });
    refresh();
  }

  return (
    <div className="lg-fade-in">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, flexWrap: "wrap", gap: 14 }}>
        <div>
          <div className="lg-eyebrow" style={{ marginBottom: 6 }}>
            Vault
          </div>
          <h1 style={{ fontSize: 26 }}>Everything you've saved</h1>
        </div>
        <AddMenu
          align="right"
          trigger={(toggle) => (
            <button className="lg-btn lg-btn-accent" onClick={toggle}>
              <Plus size={15} /> Add
            </button>
          )}
        />
      </div>

      <div className="lg-vault-grid with-panel">
        <div>
          <FilterBar query={query} onQuery={setQuery} category={category} onCategory={setCategory} sort={sort} onSort={setSort} view={view} onView={setView} />
          <FileList
            files={files}
            collectionsById={collectionsById}
            view={view}
            onOpen={openFile}
            onToggleStar={toggleStar}
            emptyProps={{
              icon: PANELS.find((p) => p.key === panel).icon,
              title: query ? "No matches" : "Nothing here yet",
              body: query ? "Try a different search term or filter." : "Upload a file or adjust your filters to see items here.",
            }}
          />
        </div>

        <div className="lg-card lg-card-pad" style={{ height: "fit-content" }}>
          <div className="lg-eyebrow" style={{ marginBottom: 10 }}>
            Browse
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {PANELS.map((p) => {
              const Icon = p.icon;
              return (
                <button key={p.key} className={cx("lg-settings-tab", panel === p.key && "active")} onClick={() => setPanel(p.key)}>
                  <Icon size={15} />
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
