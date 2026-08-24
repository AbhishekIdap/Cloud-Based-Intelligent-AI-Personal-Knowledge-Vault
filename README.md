# LifeGraph

A real full-stack build of the LifeGraph prototype: Next.js frontend, Node/Express API,
Postgres (using your `schema.sql` unchanged, plus two missing `CREATE EXTENSION`
statements it referenced), and file uploads to S3-compatible object storage.

```
lifegraph/
├── backend/     Express API, JWT auth, S3 presigned uploads, Postgres
├── frontend/    Next.js 14 (App Router), same visual design as the prototype
└── docker-compose.yml   Postgres + MinIO (local S3) + both servers
```

## Quickest path: Docker Compose

```bash
cd lifegraph
cp backend/.env.example backend/.env
docker compose up --build
```

Then, in a separate terminal, apply the schema once the Postgres container is up:

```bash
docker compose exec backend node src/migrate.js
```

> **Already have a database from before this change?** `migrate.js` runs
> `schema.sql` as a single script and isn't safe to re-run against
> existing tables (it'll error on `CREATE TABLE` that's already there).
> Run the new additive migration instead — it only adds two nullable
> columns and two indexes, no data is touched:
> ```bash
> docker compose exec -T postgres psql -U lifegraph -d lifegraph \
>   < backend/migrations/002_manual_and_ai_descriptions.sql
> ```

- Frontend: http://localhost:3000
- Backend health check: http://localhost:4000/health
- MinIO console (view uploaded files): http://localhost:9001 (minioadmin / minioadmin)

Sign up for an account at http://localhost:3000/signup — that's it.

## Running without Docker

**1. Postgres** — use a local install or any hosted Postgres (Supabase, RDS, Neon, etc).
Set `DATABASE_URL` in `backend/.env`, then:

```bash
cd backend
npm install
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET, S3_* vars
npm run migrate         # applies schema.sql — fresh databases only, see note above
npm run dev              # http://localhost:4000
```

Already have data in this database? Run the additive migration instead of
`npm run migrate`:
```bash
psql "$DATABASE_URL" -f migrations/002_manual_and_ai_descriptions.sql
```

**2. Object storage** — any S3-compatible bucket works: AWS S3, Cloudflare R2,
Backblaze B2, or MinIO for local dev (`docker run -p 9000:9000 -p 9001:9001 minio/minio server /data --console-address ":9001"`,
then create a `lifegraph-files` bucket in its console and make it public, or
keep it private and rely on the app's presigned-download-URL endpoint).

**3. Frontend**:

```bash
cd frontend
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_URL
npm run dev                   # http://localhost:3000
```

## How uploads work

1. Client asks the backend for a presigned S3 PUT URL (`POST /api/files/upload-url`) —
   no DB row yet, no bytes touch the backend.
2. Client uploads the file straight to S3/MinIO with that URL.
3. Client confirms with the backend (`POST /api/files`), which writes the
   `files` row, runs server-side categorization (source of truth over the
   client's instant guess), auto-suggests a collection by keyword match, and
   enforces the user's `storage_cap_kb` quota.

This matches the notes already in your `schema.sql` about keeping bytes out
of Postgres and enforcing quota at the API layer.

## What's real vs. still a stand-in

- **Categorization & collection-suggestion**: ported rule-based logic from
  the prototype (`categorizeFile` / `suggestCollection`), running
  server-side now. Wiring in real ML/embedding-based categorization is the
  next step the schema comments describe (pgvector over collection
  name+description+keywords).
- **AI Assistant**: three-tier fallback chain in `answerQuery()`
  (`backend/src/routes/assistant.js`):
  1. **Claude** (`claudeAnswer()`), if `ANTHROPIC_API_KEY` is set. Each turn,
     the backend builds a compact live snapshot of the user's vault
     (collections, recent/starred files, reminders, storage) and sends it as
     context. Claude answers conversationally and marks which files (by ID,
     from the snapshot only) are relevant to show.
  2. **Gemini** (`geminiAnswer()`), if `GEMINI_API_KEY` is set instead. Same
     vault-snapshot context, but Gemini is additionally given real tools —
     search files, list a collection, check storage, list/create reminders,
     star/hide a file, move a file between collections, delete a file (with
     a two-step confirm) — defined in
     `backend/src/lib/geminiAssistantTools.js`. So this path can act on the
     vault, not just describe it. Gemini's API has a free, non-expiring
     tier — get a key at https://aistudio.google.com/apikey.
  3. **Rule-based** (`ruleBasedAnswer()`) — the original keyword-matching
     responder, used if neither key is set or a live call fails for any
     reason, so the feature never hard-breaks.
- **File previews**: opening any file with a stored object (photo, video,
  recording, PDF, or plain-text document) shows an inline preview in
  `FileDetailModal` — image/video/audio players, an embedded PDF viewer, or
  the text itself, fetched fresh each time via the existing
  `/files/:id/download-url` presigned-URL endpoint. Other document types
  (.docx etc.) fall back to a "use Download" notice, since browsers can't
  render those natively. Grid/list thumbnails are unchanged (still
  `thumbnail_url`/category icon) — generating real thumbnails for every card
  would mean a presigned request per file on every page load, so that's
  still the "next step" described below rather than done automatically.
- **Notification popups + sound**: in addition to the existing bell
  dropdown, `NotificationWatcher` (mounted once in the app shell) polls
  `GET /notifications` every 15s, and any notification that wasn't there
  last poll pops a toast (existing `Toast` component) and plays a short
  generated chime (`lib/notificationSound.js` — Web Audio, no audio file to
  host). It also dispatches an `lg:notifications-changed` event so the bell
  badge updates live, the same pattern the app already uses for
  `lg:files-changed`.
- **Thumbnails**: the schema has `thumbnail_url`; this build doesn't
  generate thumbnails yet (e.g. a Lambda/worker on S3 upload events, or a
  Sharp-based resize step in the confirm endpoint) — files show a category
  icon in grids/lists until that's added. (The file *preview* inside the
  detail modal, described above, is separate and already real.)

## Auth

Simple email/password + JWT (bcrypt-hashed, 30-day tokens by default). No
sessions table — stateless tokens. Add refresh tokens / revocation if you need
shorter-lived access tokens later.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the full list.
