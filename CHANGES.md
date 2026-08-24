# What changed in this pass

Three features added. Every existing function/route/component was left as-is —
everything below is either a new file or a small addition to an existing one
(nothing removed, nothing rewritten).

## 1. File previews (frontend only)

- **New:** `FilePreview` component inside `frontend/components/FileDetailModal.jsx`
  — opening any file with a stored object shows an image, video player, audio
  player, embedded PDF, or (for `.txt`-like files) the text itself, fetched
  via the download-url endpoint that already existed.
- **New CSS:** a few `.lg-preview-*` rules appended to `frontend/app/globals.css`.
- No backend changes needed — reused `/files/:id/download-url`.

## 2. AI assistant — Gemini as a free, action-capable alternative to Claude

- **New:** `backend/src/lib/gemini.js` — Gemini client + tool-calling loop
  (mirrors the shape of the existing `lib/claude.js`).
- **New:** `backend/src/lib/geminiAssistantTools.js` — the actions Gemini can
  take: search files, list a collection, check storage, list/create
  reminders, star/hide a file, move a file between collections, delete a
  file (two-step confirm).
- **Added to** `backend/src/routes/assistant.js`: a `geminiAnswer()`
  function, plus one more branch in the existing `answerQuery()` fallback
  chain. New order: **Claude (if configured) → Gemini (if configured) →
  rule-based**. `claudeAnswer()` and `ruleBasedAnswer()` are untouched.
- **Added to** `backend/package.json`: `@google/genai` dependency.
- **Added to** `backend/.env.example`: `GEMINI_API_KEY` / `GEMINI_MODEL`.

### To turn it on
```
cd backend
npm install
```
Then set in `backend/.env`:
```
GEMINI_API_KEY=your_key_from_aistudio.google.com/apikey
```
Leave `ANTHROPIC_API_KEY` blank if you want Gemini (free) to be the active
provider instead of Claude — the app checks Claude first, Gemini second.

## 3. Notification popups + sound (frontend only)

- **New:** `frontend/lib/notificationSound.js` — generates a short chime
  with the Web Audio API, no audio file needed.
- **New:** `frontend/components/NotificationWatcher.jsx` — polls
  `GET /notifications` every 15s; anything new pops a toast (reusing the
  existing `Toast` component) and plays the chime.
- **Added to** `frontend/app/(app)/layout.jsx`: mounts `<NotificationWatcher />`
  once in the app shell.
- **Added to** `frontend/components/Topbar.jsx`: one `useEffect` listening
  for an `lg:notifications-changed` event (dispatched by `NotificationWatcher`)
  so the bell badge updates live — same pattern the app already used for
  `lg:files-changed`.

No backend changes needed — notifications were already being written to the
DB on upload/reminder events; this just polls and surfaces them.

## Known limitations, honestly

- **Grid/list thumbnails** (the small square previews in the vault grid)
  are unchanged — still `thumbnail_url` or a category icon. Real thumbnails
  for every card would mean a presigned request per file per page load;
  that's real generation work (e.g. a Sharp resize step on upload), not
  something to bolt on as a side effect of this pass.
- **Gemini's `delete_file` tool** requires two turns: first call always
  returns a confirmation prompt, second call only proceeds if the user's
  reply clearly confirmed. This depends on the model reading its own tool
  instructions correctly — it's a strong nudge, not a hard guarantee. Worth
  keeping an eye on with real usage.
- Notification polling is a plain `setInterval`, not a websocket/SSE push —
  fine for personal use, would want a real push mechanism at higher scale.

---

# Pass 2 — upload/note split, real storage, searchable descriptions, rename, speed

Seven fixes, all additive — nothing above was rewritten or removed.

## 1. Upload vs. New note — restored as two separate flows

The "Create" sidebar item and the Vault page's upload button had both
collapsed into just opening `UploadModal`; the note-creation flow existed
on the backend (`api.createNote`, `note_content` column) but had no
frontend entry point.

- **New:** `frontend/components/NewNoteModal.jsx` — title, note body,
  optional description, collection picker. Calls the existing
  `api.createNote()`.
- **New:** `frontend/components/AddMenu.jsx` — small popover ("Upload
  file" / "New note") that wraps any trigger button.
- **Changed:** `Sidebar.jsx`'s "Create" item and `vault/page.jsx`'s
  upload button now render `AddMenu` instead of calling `openUpload()`
  directly.
- **Added to** `AppModalsContext.jsx`: `noteState` / `openNewNote` /
  `closeNewNote`, alongside the existing upload state.
- **Added to** `app/(app)/layout.jsx`: renders `NewNoteModal` next to
  `UploadModal`, same `lg:files-changed` dispatch on success.
- Dashboard's and a collection's own "Upload" buttons were left as
  direct-upload shortcuts — only the two spots you flagged got the split.
  Say the word if you want it everywhere.

## 2. Storage panel showing 0 / not updating

Root cause: `useStorage()` (`lib/hooks.js`) fetched `/users/me/storage`
once on mount but never listened for `lg:files-changed` — every other
hook in the file does. Upload or delete a file and the sidebar number
just never moved.

- **Changed:** `useStorage()` now calls `useFilesChangedListener(refresh)`
  internally, so it refreshes exactly when the vault list does. Also added
  a try/catch so a failed fetch doesn't leave state stuck silently.
- Nothing else touched — `GET /users/me/storage` itself was already correct.

## 3–5. Manual + AI-generated descriptions, both searchable

- **Schema (`schema.sql` + new `backend/migrations/002_manual_and_ai_descriptions.sql`):**
  added `description` (manual), `ai_summary` (automatic), `ai_summary_status`
  (`pending`/`done`/`failed`/`skipped`), with trigram indexes on both new
  text columns. The migration file is idempotent (`ADD COLUMN IF NOT
  EXISTS`) — run it once against your existing DB, see the file header for
  the exact command. `schema.sql` itself already has the columns for
  anyone doing a fresh install.
- **New:** `backend/src/lib/summarize.js` — after upload, sends the
  file's actual bytes (image → Gemini vision, PDF/CSV → document
  understanding, text/notes → plain text) to Gemini with a one-sentence
  "describe this concretely" prompt, gated on `GEMINI_API_KEY` being set
  (Gemini specifically, not Claude — this runs on every upload and the
  whole point of the Gemini path was a free, non-expiring tier; not
  spending a paid key on file captions). Video/audio are skipped for now
  (unreliable, not worth the latency).
- **`files.js`:** `POST /files` accepts `description`; fires
  `runAutoSummary()` **without awaiting it** right before responding, so
  the upload request itself never gets slower. New
  `POST /files/:id/summarize` to (re)trigger it manually. `PATCH /files/:id`
  now accepts `description`. The `q=` search clause now matches name OR
  note_content OR description OR ai_summary.
- **`geminiAssistantTools.js`** and **`assistant.js`**'s rule-based
  fallback: same four-column search, so the AI assistant and the
  no-AI-configured fallback both benefit too.
- **Frontend:** `UploadModal.jsx` gained a per-file "add a note" textarea;
  `FileDetailModal.jsx` gained an always-visible Description field plus a
  read-only AI-summary panel (shows "Reading this file's contents…" while
  pending, or a "Generate/Retry" button if it hasn't run yet); `FileList.jsx`'s
  grid cards show the description (or AI summary as fallback) as a one-line
  caption under the name, so ten similarly-named screenshots are tellable
  apart at a glance, not just via search.

## 6. Rename

`FileDetailModal.jsx` only ever showed the name as a static modal title.
Added a "Rename" button beside Delete in the footer that reveals an
editable Name field; the existing Save button commits it (along with
description/note edits) via the same `PATCH /files/:id`.

## 7. AI assistant feels slow

Two real issues found in `backend/src/lib/gemini.js`:

- Multiple tool calls within one round were executed in a sequential
  `for` loop, so a turn needing e.g. `search_files` + `set_star` paid
  both calls' latency back-to-back. **Changed** to `Promise.all` — the
  independent DB calls now run concurrently.
- No timeout on any Gemini round-trip, so a slow/stuck network hop could
  hang the whole reply indefinitely. **Added** a 25s `withTimeout()`
  wrapper on every `interactions.create()` call, so a stall fails fast
  into the rule-based fallback instead of leaving you staring at a
  spinner. Same fix mirrored in `lib/claude.js` for consistency.
- Also worth knowing: in the zip you sent, `backend/.env` currently has
  **both** `ANTHROPIC_API_KEY` and `GEMINI_API_KEY` empty, so responses
  are actually coming from the instant rule-based fallback right now —
  worth confirming that matches what you expect on your real deployment.

## Honest note on this pass

My memory of our earlier conversations said a prior session had already
built the description/ai_summary columns, this exact storage-hook fix, and
the Gemini timeout/parallelization work. None of that was actually present
in the zip you sent — `schema.sql` had no `description`/`ai_summary`
columns, `useStorage()` didn't listen for `lg:files-changed`, and
`gemini.js`'s tool loop was still sequential with no timeout. Everything in
this section was built fresh against what's really in your code, not
assumed from memory. If you have another copy of the project where that
earlier session's changes did land, flag it so we don't end up with two
diverging versions.
