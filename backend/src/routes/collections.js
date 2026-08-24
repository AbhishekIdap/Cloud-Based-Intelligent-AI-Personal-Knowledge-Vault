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
      `SELECT c.*,
              COUNT(f.id) FILTER (WHERE f.id IS NOT NULL) AS file_count,
              COALESCE(SUM(f.size_kb), 0) AS total_kb
       FROM collections c
       LEFT JOIN files f ON f.collection_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC`,
      [req.userId]
    );
    res.json({ collections: result.rows });
  })
);

router.get(
  "/:id",
  asyncRoute(async (req, res) => {
    const result = await db.query(`SELECT * FROM collections WHERE id = $1 AND user_id = $2`, [
      req.params.id,
      req.userId,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: "Collection not found" });
    res.json({ collection: result.rows[0] });
  })
);

router.post(
  "/",
  asyncRoute(async (req, res) => {
    const { name, description = "", icon = "📁", color = "sage", keywords = [] } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });

    const result = await db.query(
      `INSERT INTO collections (user_id, name, description, icon, color, keywords)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, name, description, icon, color, keywords]
    );
    res.status(201).json({ collection: result.rows[0] });
  })
);

router.patch(
  "/:id",
  asyncRoute(async (req, res) => {
    const allowed = ["name", "description", "icon", "color", "keywords"];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];
    const keys = Object.keys(patch);
    if (keys.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

    const setClause = keys.map((k, i) => `${k} = $${i + 3}`).join(", ");
    const result = await db.query(
      `UPDATE collections SET ${setClause} WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId, ...keys.map((k) => patch[k])]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Collection not found" });
    res.json({ collection: result.rows[0] });
  })
);

router.delete(
  "/:id",
  asyncRoute(async (req, res) => {
    // Files keep existing per schema's ON DELETE SET NULL — they just lose their collection.
    const result = await db.query(`DELETE FROM collections WHERE id = $1 AND user_id = $2 RETURNING id`, [
      req.params.id,
      req.userId,
    ]);
    if (!result.rows[0]) return res.status(404).json({ error: "Collection not found" });
    res.status(204).end();
  })
);

module.exports = router;
