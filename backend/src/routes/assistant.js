const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/errorHandler");
const { formatBytes } = require("../lib/format");
const claude = require("../lib/claude");
const gemini = require("../lib/gemini");
const { toolDeclarations: geminiTools, buildExecutor: buildGeminiExecutor } = require("../lib/geminiAssistantTools");

const router = express.Router();
router.use(requireAuth);

const CATEGORY_LABEL = {
  note: "Notes",
  document: "Documents",
  pdf: "PDFs",
  photo: "Photos",
  video: "Videos",
  recording: "Recordings",
};

// Ported from computeAnswer() in the original prototype, but querying real
// rows instead of an in-memory array. This is the automatic fallback used
// whenever ANTHROPIC_API_KEY isn't set, or if a live Claude call fails —
// see claudeAnswer() below for the real AI path.
async function ruleBasedAnswer(rawQuery, userId) {
  const q = rawQuery.toLowerCase();

  const { rows: collections } = await db.query(`SELECT * FROM collections WHERE user_id = $1`, [userId]);
  const matchedCollection = collections.find(
    (c) => q.includes(c.name.toLowerCase()) || (c.keywords || []).some((k) => q.includes(k))
  );

  if ((q.includes("play") || q.includes("show") || q.includes("open")) && matchedCollection) {
    const { rows: media } = await db.query(
      `SELECT * FROM files WHERE user_id = $1 AND collection_id = $2 AND hidden = FALSE ORDER BY viewed_at DESC LIMIT 6`,
      [userId, matchedCollection.id]
    );
    if (media.length === 0) {
      return { text: `"${matchedCollection.name}" doesn't have anything in it yet.`, files: [] };
    }
    const totalKb = media.reduce((s, f) => s + Number(f.size_kb), 0);
    return {
      text: `Here's everything in ${matchedCollection.icon} "${matchedCollection.name}" — ${media.length} item${media.length !== 1 ? "s" : ""}, ${formatBytes(totalKb)} total.`,
      files: media,
      collection: matchedCollection,
    };
  }

  if ((q.includes("find") || q.includes("document") || q.includes("file")) && matchedCollection) {
    const { rows: docs } = await db.query(
      `SELECT * FROM files WHERE user_id = $1 AND collection_id = $2 AND hidden = FALSE AND category IN ('document','pdf','note') LIMIT 6`,
      [userId, matchedCollection.id]
    );
    if (docs.length === 0) {
      return { text: `I couldn't find any documents under "${matchedCollection.name}" — everything there is media instead.`, files: [] };
    }
    return { text: `Found ${docs.length} document${docs.length !== 1 ? "s" : ""} in "${matchedCollection.name}":`, files: docs, collection: matchedCollection };
  }

  if (matchedCollection) {
    const { rows: items } = await db.query(
      `SELECT * FROM files WHERE user_id = $1 AND collection_id = $2 AND hidden = FALSE LIMIT 6`,
      [userId, matchedCollection.id]
    );
    return { text: `"${matchedCollection.name}" has ${items.length} item${items.length !== 1 ? "s" : ""}. Here's a look:`, files: items, collection: matchedCollection };
  }

  if (q.includes("storage") || q.includes("space")) {
    const { rows: userRows } = await db.query(`SELECT storage_cap_kb FROM users WHERE id = $1`, [userId]);
    const { rows: byCategory } = await db.query(
      `SELECT category, SUM(size_kb) AS kb FROM files WHERE user_id = $1 GROUP BY category ORDER BY kb DESC LIMIT 1`,
      [userId]
    );
    const { rows: usedRows } = await db.query(`SELECT COALESCE(SUM(size_kb),0) AS used FROM files WHERE user_id = $1`, [userId]);
    const capKb = Number(userRows[0].storage_cap_kb);
    const usedKb = Number(usedRows[0].used);
    const pct = capKb ? Math.round((usedKb / capKb) * 100) : 0;
    const top = byCategory[0];
    return {
      text: `You're using ${formatBytes(usedKb)} of ${formatBytes(capKb)} (${pct}%). ${top ? `${CATEGORY_LABEL[top.category]} take up the most space at ${formatBytes(Number(top.kb))}.` : ""}`,
      files: [],
    };
  }

  if (q.includes("star")) {
    const { rows: starred } = await db.query(
      `SELECT * FROM files WHERE user_id = $1 AND starred = TRUE AND hidden = FALSE ORDER BY viewed_at DESC LIMIT 6`,
      [userId]
    );
    if (starred.length === 0) return { text: "You haven't starred anything yet — open a file and tap the star to pin it here.", files: [] };
    return { text: "Here are your starred items, most recent first:", files: starred };
  }

  if (q.includes("hidden")) {
    const { rows: hidden } = await db.query(`SELECT id FROM files WHERE user_id = $1 AND hidden = TRUE`, [userId]);
    if (hidden.length === 0) return { text: "Nothing's hidden right now.", files: [] };
    return { text: `You have ${hidden.length} hidden item${hidden.length !== 1 ? "s" : ""}. Manage visibility from Settings → Hidden files.`, files: [] };
  }

  if (q.includes("remind")) {
    const { rows: upcoming } = await db.query(
      `SELECT * FROM reminders WHERE user_id = $1 AND done = FALSE ORDER BY due_at ASC LIMIT 4`,
      [userId]
    );
    if (upcoming.length === 0) return { text: "No open reminders — you're clear.", files: [] };
    const lines = upcoming.map((r) => `• ${r.title} — ${new Date(r.due_at).toLocaleDateString()}`).join("\n");
    return { text: `Coming up:\n${lines}`, files: [] };
  }

  if (q.includes("recent") || q.includes("latest") || q.includes("new")) {
    const { rows: recent } = await db.query(
      `SELECT * FROM files WHERE user_id = $1 AND hidden = FALSE ORDER BY created_at DESC LIMIT 6`,
      [userId]
    );
    return { text: "Your most recently added items:", files: recent };
  }

  const { rows: hits } = await db.query(
    `SELECT * FROM files WHERE user_id = $1 AND hidden = FALSE
       AND (name ILIKE $2 OR note_content ILIKE $2 OR description ILIKE $2 OR ai_summary ILIKE $2) LIMIT 6`,
    [userId, `%${rawQuery}%`]
  );
  if (hits.length > 0) {
    return { text: `Here's what I found for "${rawQuery}":`, files: hits };
  }
  return {
    text: `I couldn't match anything to "${rawQuery}" yet. Try naming a collection, a file type, or ask about storage and reminders.`,
    files: [],
  };
}

// ---- Real AI path ----
// Builds a compact, current snapshot of the user's vault, hands it to
// Claude as context, and asks Claude to (a) answer conversationally and
// (b) name which of the provided file IDs are relevant, wrapped in a
// <files>id,id</files> tag we parse out afterward. Claude never sees other
// users' data, and we only ever look up files by ID scoped to this user —
// so even a malformed/hallucinated ID can't leak someone else's file.
async function buildVaultContext(userId) {
  const [collections, recentFiles, starredFiles, reminders, storageRows, userRow] = await Promise.all([
    db.query(`SELECT id, name, description, icon, keywords FROM collections WHERE user_id = $1`, [userId]),
    db.query(
      `SELECT id, name, category, collection_id, starred, size_kb, created_at FROM files
       WHERE user_id = $1 AND hidden = FALSE ORDER BY created_at DESC LIMIT 40`,
      [userId]
    ),
    db.query(
      `SELECT id, name, category, collection_id FROM files WHERE user_id = $1 AND starred = TRUE AND hidden = FALSE LIMIT 20`,
      [userId]
    ),
    db.query(
      `SELECT id, title, due_at FROM reminders WHERE user_id = $1 AND done = FALSE ORDER BY due_at ASC LIMIT 10`,
      [userId]
    ),
    db.query(`SELECT category, SUM(size_kb) AS kb FROM files WHERE user_id = $1 GROUP BY category`, [userId]),
    db.query(`SELECT storage_cap_kb FROM users WHERE id = $1`, [userId]),
  ]);

  const usedKb = storageRows.rows.reduce((s, r) => s + Number(r.kb), 0);

  return {
    collections: collections.rows,
    recentFiles: recentFiles.rows,
    starredFiles: starredFiles.rows,
    reminders: reminders.rows,
    storage: {
      usedKb,
      capKb: Number(userRow.rows[0]?.storage_cap_kb || 0),
      byCategory: storageRows.rows,
    },
  };
}

async function claudeAnswer(content, userId, history) {
  const context = await buildVaultContext(userId);

  const system = `You are the LifeGraph AI Assistant, built into a personal file-and-memory vault app. Be warm, concise, and conversational — a few sentences, not a report.

You're given a JSON snapshot of this user's vault below. Only reference collections, files, and reminders that actually appear in it — never invent names, dates, or IDs.

If your answer should show specific files to the user, end your reply with a tag listing their IDs, comma-separated, using ONLY ids present in the JSON below, like this: <files>id-one,id-two</files>
Omit that tag entirely if no specific files are relevant to show.

Vault snapshot (JSON):
${JSON.stringify(context)}`;

  const messages = [...history, { role: "user", content }];
  const raw = await claude.chat({ system, messages });

  const match = raw.match(/<files>([^<]*)<\/files>/);
  const text = raw.replace(/<files>[^<]*<\/files>/, "").trim();
  const ids = match
    ? match[1]
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  let files = [];
  if (ids.length > 0) {
    const { rows } = await db.query(`SELECT * FROM files WHERE user_id = $1 AND id = ANY($2::uuid[])`, [userId, ids]);
    files = rows;
  }

  return { text, files };
}

// ---- Gemini path (free tier, action-capable) ----
// Same idea as claudeAnswer() above — vault snapshot as context — but
// Gemini is additionally given real tools (search, star/hide, move files
// between collections, create reminders, delete with confirmation) via
// lib/geminiAssistantTools.js, so it can act on the vault, not just
// describe it. This runs whenever ANTHROPIC_API_KEY isn't set but
// GEMINI_API_KEY is — see answerQuery() below for the fallback order.
async function geminiAnswer(content, userId, history) {
  const context = await buildVaultContext(userId);

  const systemPrompt = `You are the LifeGraph AI Assistant, built into a personal file-and-memory vault app. Be warm, concise, and conversational — a few sentences, not a report.

You have tools to look things up AND take actions: search files, list a collection's contents, check storage, list/create reminders, star or hide a file, move a file to a different collection, and delete a file. Use a tool whenever the user asks you to find, show, organize, or manage something — don't just describe what you would do, actually call the tool and then tell the user what happened.

Only reference collections, files, and reminders that tools actually return — never invent names, dates, or IDs. For delete_file specifically, follow the two-step confirmation rule described in its tool definition exactly: ask first, only act after the user clearly confirms.

For quick reference, here's a snapshot of the user's vault as of the start of this conversation (tool calls always return live, current data — this is just background):
${JSON.stringify(context)}`;

  // The Interactions API session below is only stateful across the
  // tool-call round trips within this one turn (via previous_interaction_id
  // inside chatWithTools). To keep answers aware of earlier chat turns too,
  // fold recent history into the input text itself.
  const historyText = history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`).join("\n");
  const userContent = historyText ? `${historyText}\nUser: ${content}` : content;

  const { text, actions } = await gemini.chatWithTools({
    systemPrompt,
    userContent,
    tools: geminiTools,
    executeTool: buildGeminiExecutor(userId),
  });

  // Re-fetch fresh rows (post any mutations) for any file IDs surfaced by
  // tool results, mirroring how claudeAnswer() resolves its <files> tag.
  const fileIds = new Set();
  for (const action of actions) {
    const r = action.result || {};
    (r.files || []).forEach((f) => f?.id && fileIds.add(f.id));
    if (r.updated?.id) fileIds.add(r.updated.id);
  }

  let files = [];
  if (fileIds.size > 0) {
    const { rows } = await db.query(`SELECT * FROM files WHERE user_id = $1 AND id = ANY($2::uuid[])`, [
      userId,
      Array.from(fileIds),
    ]);
    files = rows;
  }

  return { text: text || "Done.", files };
}

async function answerQuery(content, userId, history = []) {
  if (claude.isConfigured()) {
    try {
      return await claudeAnswer(content, userId, history);
    } catch (err) {
      console.error("Claude call failed, falling back:", err.message);
      // fall through below
    }
  }
  if (gemini.isConfigured()) {
    try {
      return await geminiAnswer(content, userId, history);
    } catch (err) {
      console.error("Gemini call failed, falling back to rule-based assistant:", err.message);
      // fall through to rule-based below
    }
  }
  return ruleBasedAnswer(content, userId);
}

router.get(
  "/messages",
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT * FROM assistant_messages WHERE user_id = $1 ORDER BY created_at ASC LIMIT 200`,
      [req.userId]
    );
    res.json({ messages: result.rows });
  })
);

router.post(
  "/messages",
  asyncRoute(async (req, res) => {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: "content is required" });

    const priorRows = await db.query(
      `SELECT role, content FROM assistant_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [req.userId]
    );
    const history = priorRows.rows.reverse().map((m) => ({ role: m.role, content: m.content }));

    await db.query(
      `INSERT INTO assistant_messages (user_id, role, content) VALUES ($1, 'user', $2)`,
      [req.userId, content]
    );

    const answer = await answerQuery(content, req.userId, history);
    const fileIds = (answer.files || []).map((f) => f.id);

    const assistantRow = await db.query(
      `INSERT INTO assistant_messages (user_id, role, content, referenced_file_ids)
       VALUES ($1, 'assistant', $2, $3) RETURNING *`,
      [req.userId, answer.text, fileIds]
    );

    res.status(201).json({ message: assistantRow.rows[0], files: answer.files || [] });
  })
);

module.exports = router;
