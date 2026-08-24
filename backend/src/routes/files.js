const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/errorHandler");
const { getUploadUrl, getDownloadUrl, deleteObject, getObjectBuffer } = require("../lib/s3");
const { categorizeFile, suggestCollection } = require("../lib/categorize");
const summarize = require("../lib/summarize");

const router = express.Router();
router.use(requireAuth);

// ---- List / filter (backs the Vault page) ----
router.get(
  "/",
  asyncRoute(async (req, res) => {
    const { category, collectionId, starred, hidden, includeHidden, q, sort = "recent" } = req.query;

    const clauses = ["user_id = $1"];
    const params = [req.userId];

    if (category) {
      params.push(category);
      clauses.push(`category = $${params.length}`);
    }
    if (collectionId) {
      params.push(collectionId);
      clauses.push(`collection_id = $${params.length}`);
    }
    if (starred === "true") clauses.push("starred = TRUE");

    if (hidden === "true") {
      clauses.push("hidden = TRUE");
    } else if (hidden === "false") {
      clauses.push("hidden = FALSE");
    } else if (includeHidden !== "true") {
      // Default: hide hidden files, unless the caller explicitly opts in via
      // includeHidden=true (the Vault page does this when the user's
      // show_hidden setting is on, mixing hidden files back into the list —
      // matches the original prototype's settings.showHidden behavior).
      clauses.push("hidden = FALSE");
    }
    if (q) {
      params.push(`%${q}%`);
      // Matches the file name, the user's own manual note, AND the
      // AI-generated content summary (see lib/summarize.js) — this is what
      // lets a search for e.g. "electricity bill" find a screenshot named
      // "Screenshot 2026-01-28 192830.png" that nobody manually labeled.
      clauses.push(
        `(name ILIKE $${params.length} OR note_content ILIKE $${params.length} OR description ILIKE $${params.length} OR ai_summary ILIKE $${params.length})`
      );
    }

    const orderBy =
      {
        recent: "viewed_at DESC",
        newest: "created_at DESC",
        oldest: "created_at ASC",
        name: "name ASC",
        largest: "size_kb DESC",
      }[sort] || "viewed_at DESC";

    const result = await db.query(
      `SELECT * FROM files WHERE ${clauses.join(" AND ")} ORDER BY ${orderBy}`,
      params
    );
    res.json({ files: result.rows });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const result = await db.query(`SELECT * FROM files WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.userId,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: "File not found" });
    res.json({ file: result.rows[0] });
  })
);

// ---- Step 1 of upload: get a presigned PUT URL. No DB row yet — the client
// uploads bytes straight to S3, then calls POST / below to write metadata,
// per the "generate presigned URL, write the row after upload succeeds" note
// in schema.sql. ----
router.post(
  "/upload-url",
  asyncRoute(async (req, res) => {
    const { fileName, contentType } = req.body;
    if (!fileName) return res.status(400).json({ error: "fileName is required" });

    const { key, uploadUrl, publicUrl } = await getUploadUrl({
      userId: req.userId,
      fileName,
      contentType,
    });
    const suggestedCategory = categorizeFile({ name: fileName, mimeType: contentType });
    res.json({ key, uploadUrl, publicUrl, suggestedCategory });
  })
);

// ---- Step 2 of upload: confirm — write the files row once the client has
// finished the S3 PUT. Also used to enforce the user's storage quota, per
// schema.sql note #4 (enforce at the API layer, not just in the UI). ----
router.post(
  "/",
  asyncRoute(async (req, res) => {
    const { name, key, sizeKb = 0, mimeType, collectionId, category, noteContent, description } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    if (!key && !noteContent) return res.status(400).json({ error: "key (uploaded object) or noteContent is required" });

    const userResult = await db.query(`SELECT storage_cap_kb FROM users WHERE id = $1`, [req.userId]);
    const usedResult = await db.query(
      `SELECT COALESCE(SUM(size_kb), 0) AS used FROM files WHERE user_id = $1`,
      [req.userId]
    );
    const capKb = Number(userResult.rows[0].storage_cap_kb);
    const usedKb = Number(usedResult.rows[0].used);
    if (usedKb + Number(sizeKb) > capKb) {
      return res.status(413).json({ error: "This upload would exceed your storage quota." });
    }

    let finalCollectionId = collectionId || null;
    let categorySource = "rule_based";
    let finalCategory = category;
    if (!finalCategory) {
      finalCategory = noteContent ? "note" : categorizeFile({ name, mimeType });
    } else {
      categorySource = "user";
    }

    if (!finalCollectionId) {
      const collections = await db.query(`SELECT id, name, keywords FROM collections WHERE user_id = $1`, [
        req.userId,
      ]);
      const suggestion = suggestCollection(name, collections.rows);
      if (suggestion) finalCollectionId = suggestion.id;
    }

    const willAutoSummarize = summarize.isConfigured() && (noteContent || key);
    const result = await db.query(
      `INSERT INTO files (user_id, collection_id, name, category, category_source, size_kb, storage_url, mime_type, note_content, description, ai_summary_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        req.userId,
        finalCollectionId,
        name,
        finalCategory,
        categorySource,
        sizeKb,
        key || null,
        mimeType || null,
        noteContent || null,
        description || null,
        willAutoSummarize ? "pending" : "skipped",
      ]
    );

    const file = result.rows[0];

    if (!noteContent) {
      await db.query(
        `INSERT INTO notifications (user_id, kind, title, body) VALUES ($1, 'upload', 'File uploaded', $2)`,
        [req.userId, `"${name}" was added to your vault.`]
      );
    }

    // Fire-and-forget: describe the file's actual content in the background
    // so search can match it later (item 3-5 in the "make search smarter"
    // ask). Deliberately NOT awaited — the upload response goes back to the
    // client immediately either way, so this never adds latency to uploads.
    if (willAutoSummarize) {
      runAutoSummary(file).catch((err) => console.error("Auto-summary job crashed:", err.message));
    }

    res.status(201).json({ file });
  })
);

// ---- Background job: fills in ai_summary after the response has already
// gone out. See lib/summarize.js for the strategy per file type. ----
async function runAutoSummary(file) {
  const getBuffer = file.storage_url ? () => getObjectBuffer(file.storage_url) : null;
  const summary = await summarize.summarizeFile({
    name: file.name,
    mimeType: file.mime_type,
    category: file.category,
    noteContent: file.note_content,
    getBuffer,
  });
  await db.query(
    `UPDATE files SET ai_summary = $1, ai_summary_status = $2 WHERE id = $3`,
    [summary, summary ? "done" : "failed", file.id]
  );
}

router.get(
  "/:id/download-url",
  asyncRoute(async (req, res) => {
    const result = await db.query(`SELECT storage_url FROM files WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.userId,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: "File not found" });
    if (!result.rows[0].storage_url) return res.status(400).json({ error: "This file has no stored object (e.g. it's a note)." });

    const url = await getDownloadUrl(result.rows[0].storage_url);
    res.json({ url });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const allowed = ["name", "collection_id", "starred", "hidden", "note_content", "category", "description"];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
    if ("category" in patch) patch.category_source = "user";
    if ("viewed" in req.body && req.body.viewed) patch.viewed_at = new Date();

    const keys = Object.keys(patch);
    if (keys.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

    const setClause = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const result = await db.query(
      `UPDATE files SET ${setClause} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId, ...keys.map((k) => patch[k])]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "File not found" });
    res.json({ file: result.rows[0] });
  })
);

// ---- Manually (re)trigger AI summarization — for files uploaded before
// this feature existed, or to refresh the summary after editing a note. ----
router.post(
  "/:id/summarize",
  asyncRoute(async (req, res) => {
    const result = await db.query(`SELECT * FROM files WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.userId,
    ]);
    const file = result.rows[0];
    if (!file) return res.status(404).json({ error: "File not found" });
    if (!summarize.isConfigured()) {
      return res.status(400).json({ error: "AI summaries need GEMINI_API_KEY configured on the server." });
    }

    await db.query(`UPDATE files SET ai_summary_status = 'pending' WHERE id = $1`, [file.id]);
    runAutoSummary(file).catch((err) => console.error("Auto-summary job crashed:", err.message));
    res.status(202).json({ ok: true });
  })
);

router.post(
  "/:id/view",
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `UPDATE files SET viewed_at = now() WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "File not found" });
    res.json({ file: result.rows[0] });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const result = await db.query(`DELETE FROM files WHERE id = $1 AND user_id = $2 RETURNING storage_url`, [
      req.params.id,
      req.userId,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: "File not found" });
    if (result.rows[0].storage_url) {
      await deleteObject(result.rows[0].storage_url).catch((err) =>
        console.error("Failed to delete S3 object (row already removed):", err.message)
      );
    }
    res.status(204).end();
  })
);

module.exports = router;
