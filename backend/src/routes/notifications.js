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
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.userId]
    );
    res.json({ notifications: result.rows });
  })
);

router.post(
  "/:id/read",
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Notification not found" });
    res.json({ notification: result.rows[0] });
  })
);

router.post(
  "/read-all",
  asyncRoute(async (req, res) => {
    await db.query(`UPDATE notifications SET read = TRUE WHERE user_id = $1 AND read = FALSE`, [req.userId]);
    res.json({ ok: true });
  })
);

module.exports = router;
