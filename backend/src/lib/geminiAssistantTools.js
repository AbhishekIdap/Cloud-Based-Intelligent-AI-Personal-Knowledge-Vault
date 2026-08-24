const db = require("../db");
const { deleteObject } = require("./s3");

// Finds a file by (fuzzy) name, scoped to the user. Returns the row, or
// null, or a special { ambiguous: true, matches } shape so the model can
// ask the user to be more specific instead of guessing.
async function findFileByName(userId, name) {
  const { rows } = await db.query(
    `SELECT * FROM files WHERE user_id = $1 AND name ILIKE $2 ORDER BY
       (LOWER(name) = LOWER($3)) DESC, created_at DESC LIMIT 5`,
    [userId, `%${name}%`, name]
  );
  if (rows.length === 0) return null;
  if (rows.length > 1 && rows[0].name.toLowerCase() !== name.toLowerCase()) {
    return { ambiguous: true, matches: rows.map((r) => r.name) };
  }
  return rows[0];
}

async function findCollectionByName(userId, name) {
  const { rows } = await db.query(
    `SELECT * FROM collections WHERE user_id = $1 AND name ILIKE $2 ORDER BY
       (LOWER(name) = LOWER($3)) DESC LIMIT 1`,
    [userId, `%${name}%`, name]
  );
  return rows[0] || null;
}

const toolDeclarations = [
  {
    type: "function",
    name: "search_files",
    description:
      "Searches the user's vault by file name, note content, manual description, and AI-generated content summary — so this can find a file by what it actually contains, not just its name. Use for any 'find X' / 'do I have Y' request.",
    parameters: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    type: "function",
    name: "list_collection_files",
    description: "Lists files inside a named collection (e.g. 'Taxes', 'Family Photos').",
    parameters: {
      type: "object",
      properties: { collectionName: { type: "string" } },
      required: ["collectionName"],
    },
  },
  {
    type: "function",
    name: "get_storage_summary",
    description: "Returns how much storage the user has used, their cap, and a breakdown by file category.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "list_reminders",
    description: "Lists the user's upcoming, not-yet-done reminders.",
    parameters: { type: "object", properties: {} },
  },
  {
    type: "function",
    name: "create_reminder",
    description: "Creates a new reminder for the user.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        dueAt: { type: "string", description: "ISO 8601 date/time, e.g. 2026-09-01T09:00:00Z" },
      },
      required: ["title", "dueAt"],
    },
  },
  {
    type: "function",
    name: "set_star",
    description: "Stars or unstars a file by name.",
    parameters: {
      type: "object",
      properties: {
        fileName: { type: "string" },
        starred: { type: "boolean", description: "true to star, false to unstar" },
      },
      required: ["fileName", "starred"],
    },
  },
  {
    type: "function",
    name: "set_hidden",
    description: "Hides or unhides a file by name.",
    parameters: {
      type: "object",
      properties: {
        fileName: { type: "string" },
        hidden: { type: "boolean", description: "true to hide, false to unhide" },
      },
      required: ["fileName", "hidden"],
    },
  },
  {
    type: "function",
    name: "move_file_to_collection",
    description: "Moves a file into a named collection. Pass collectionName omitted or empty string to remove it from any collection.",
    parameters: {
      type: "object",
      properties: {
        fileName: { type: "string" },
        collectionName: { type: "string" },
      },
      required: ["fileName"],
    },
  },
  {
    type: "function",
    name: "delete_file",
    description:
      "Permanently deletes a file. DESTRUCTIVE. The first time the user asks to delete something, call this with confirmed=false to surface a confirmation prompt — do NOT set confirmed=true yet. Only call again with confirmed=true if the user's very next message clearly says yes/confirm/go ahead in direct response to that prompt.",
    parameters: {
      type: "object",
      properties: {
        fileName: { type: "string" },
        confirmed: { type: "boolean" },
      },
      required: ["fileName", "confirmed"],
    },
  },
];

function buildExecutor(userId) {
  return async function executeTool(name, args) {
    switch (name) {
      case "search_files": {
        // Matches file name, manual description, AI-generated content
        // summary, and note body — so "find my electricity bill" can surface
        // a screenshot even if nobody typed those words into its filename.
        const { rows } = await db.query(
          `SELECT id, name, category, collection_id, size_kb, created_at, description, ai_summary FROM files
           WHERE user_id = $1 AND hidden = FALSE
             AND (name ILIKE $2 OR note_content ILIKE $2 OR description ILIKE $2 OR ai_summary ILIKE $2)
           LIMIT 10`,
          [userId, `%${args.query}%`]
        );
        return { count: rows.length, files: rows };
      }

      case "list_collection_files": {
        const collection = await findCollectionByName(userId, args.collectionName);
        if (!collection) return { error: `No collection matching "${args.collectionName}"` };
        const { rows } = await db.query(
          `SELECT id, name, category, size_kb, created_at FROM files
           WHERE user_id = $1 AND collection_id = $2 AND hidden = FALSE ORDER BY created_at DESC LIMIT 20`,
          [userId, collection.id]
        );
        return { collection: collection.name, count: rows.length, files: rows };
      }

      case "get_storage_summary": {
        const [{ rows: userRows }, { rows: byCategory }, { rows: usedRows }] = await Promise.all([
          db.query(`SELECT storage_cap_kb FROM users WHERE id = $1`, [userId]),
          db.query(`SELECT category, SUM(size_kb) AS kb FROM files WHERE user_id = $1 GROUP BY category`, [userId]),
          db.query(`SELECT COALESCE(SUM(size_kb),0) AS used FROM files WHERE user_id = $1`, [userId]),
        ]);
        return {
          usedKb: Number(usedRows[0].used),
          capKb: Number(userRows[0]?.storage_cap_kb || 0),
          byCategory: byCategory.map((r) => ({ category: r.category, kb: Number(r.kb) })),
        };
      }

      case "list_reminders": {
        const { rows } = await db.query(
          `SELECT id, title, due_at FROM reminders WHERE user_id = $1 AND done = FALSE ORDER BY due_at ASC LIMIT 10`,
          [userId]
        );
        return { reminders: rows };
      }

      case "create_reminder": {
        if (!args.title || !args.dueAt) return { error: "title and dueAt are required" };
        const due = new Date(args.dueAt);
        if (Number.isNaN(due.getTime())) return { error: "dueAt is not a valid date" };
        const { rows } = await db.query(
          `INSERT INTO reminders (user_id, title, due_at) VALUES ($1, $2, $3) RETURNING id, title, due_at`,
          [userId, args.title, due]
        );
        await db.query(
          `INSERT INTO notifications (user_id, kind, title, body) VALUES ($1, 'reminder', 'Reminder set', $2)`,
          [userId, `"${args.title}" was added to your reminders.`]
        );
        return { created: rows[0] };
      }

      case "set_star": {
        const file = await findFileByName(userId, args.fileName);
        if (!file) return { error: `No file matching "${args.fileName}"` };
        if (file.ambiguous) return { error: "Multiple files match that name", matches: file.matches };
        const { rows } = await db.query(
          `UPDATE files SET starred = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, starred`,
          [!!args.starred, file.id, userId]
        );
        return { updated: rows[0] };
      }

      case "set_hidden": {
        const file = await findFileByName(userId, args.fileName);
        if (!file) return { error: `No file matching "${args.fileName}"` };
        if (file.ambiguous) return { error: "Multiple files match that name", matches: file.matches };
        const { rows } = await db.query(
          `UPDATE files SET hidden = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, hidden`,
          [!!args.hidden, file.id, userId]
        );
        return { updated: rows[0] };
      }

      case "move_file_to_collection": {
        const file = await findFileByName(userId, args.fileName);
        if (!file) return { error: `No file matching "${args.fileName}"` };
        if (file.ambiguous) return { error: "Multiple files match that name", matches: file.matches };

        let collectionId = null;
        if (args.collectionName) {
          const collection = await findCollectionByName(userId, args.collectionName);
          if (!collection) return { error: `No collection matching "${args.collectionName}"` };
          collectionId = collection.id;
        }
        const { rows } = await db.query(
          `UPDATE files SET collection_id = $1 WHERE id = $2 AND user_id = $3 RETURNING id, name, collection_id`,
          [collectionId, file.id, userId]
        );
        return { updated: rows[0] };
      }

      case "delete_file": {
        const file = await findFileByName(userId, args.fileName);
        if (!file) return { error: `No file matching "${args.fileName}"` };
        if (file.ambiguous) return { error: "Multiple files match that name", matches: file.matches };
        if (!args.confirmed) {
          return { needsConfirmation: true, file: { id: file.id, name: file.name } };
        }
        const { rows } = await db.query(`DELETE FROM files WHERE id = $1 AND user_id = $2 RETURNING storage_url`, [
          file.id,
          userId,
        ]);
        if (rows[0]?.storage_url) {
          await deleteObject(rows[0].storage_url).catch((err) =>
            console.error("Gemini tool: failed to delete S3 object (row already removed):", err.message)
          );
        }
        return { deleted: file.name };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  };
}

module.exports = { toolDeclarations, buildExecutor };
