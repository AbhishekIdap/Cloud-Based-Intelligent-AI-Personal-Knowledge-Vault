const express = require("express");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/errorHandler");

const router = express.Router();
router.use(requireAuth);

router.get(
  "/",
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT * FROM reminders WHERE user_id = $1 ORDER BY done ASC, due_at ASC`,
      [req.userId]
    );
    res.json({ reminders: result.rows });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    const { title, dueAt, relatedFileId, relatedCollectionId } = req.body;
    if (!title || !dueAt) return res.status(400).json({ error: "title and dueAt are required" });

    const result = await db.query(
      `INSERT INTO reminders (user_id, title, due_at, related_file_id, related_collection_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.userId, title, dueAt, relatedFileId || null, relatedCollectionId || null]
    );
    await db.query(
      `INSERT INTO notifications (user_id, kind, title, body) VALUES ($1, 'reminder', 'Reminder set', $2)`,
      [req.userId, `"${title}" was added to your reminders.`]
    );
    res.status(201).json({ reminder: result.rows[0] });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const allowed = ["title", "due_at", "done"];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
    const keys = Object.keys(patch);
    if (keys.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

    const setClause = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const result = await db.query(
      `UPDATE reminders SET ${setClause} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId, ...keys.map((k) => patch[k])]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Reminder not found" });
    res.json({ reminder: result.rows[0] });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    const result = await db.query(`DELETE FROM reminders WHERE id = $1 AND user_id = $2 RETURNING id`, [
      req.params.id,
      req.userId,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: "Reminder not found" });
    res.status(204).end();
  })
);

module.exports = router;
