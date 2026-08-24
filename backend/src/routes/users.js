const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/errorHandler");

const router = express.Router();
router.use(requireAuth);

// ---- Profile (name, avatar, theme, show_hidden) ----
router.patch(
  "/me",
  asyncRoute(async (req, res) => {
    const allowed = ["name", "avatar_color", "theme", "show_hidden"];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = req.body[key];

    const keys = Object.keys(patch);
    if (keys.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const result = await db.query(
      `UPDATE users SET ${setClause} WHERE id = $1
       RETURNING id, name, email, avatar_initials, avatar_color, plan, storage_cap_kb, theme, show_hidden, created_at`,
      [req.userId, ...keys.map((k) => patch[k])]
    );
    res.json({ user: result.rows[0] });
  })
);

router.post(
  "/me/password",
  asyncRoute(async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: "currentPassword and a newPassword (8+ chars) are required" });
    }
    const result = await db.query(`SELECT password_hash FROM users WHERE id = $1`, [req.userId]);
    const ok = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    const hash = await bcrypt.hash(newPassword, 12);
    await db.query(`UPDATE users SET password_hash = $2 WHERE id = $1`, [req.userId, hash]);
    await db.query(`INSERT INTO account_events (user_id, event_type) VALUES ($1, 'password_change')`, [req.userId]);
    res.json({ ok: true });
  })
);

// ---- Notification preferences ----
router.get(
  "/me/notification-preferences",
  asyncRoute(async (req, res) => {
    const result = await db.query(`SELECT * FROM notification_preferences WHERE user_id = $1`, [req.userId]);
    res.json({ preferences: result.rows[0] });
  })
);

router.patch(
  "/me/notification-preferences",
  asyncRoute(async (req, res) => {
    const allowed = ["uploads", "reminders", "collection_activity", "security", "weekly_digest"];
    const patch = {};
    for (const key of allowed) if (key in req.body) patch[key] = !!req.body[key];
    const keys = Object.keys(patch);
    if (keys.length === 0) return res.status(400).json({ error: "No updatable fields provided" });

    const setClause = keys.map((k, i) => `${k} = $${i + 2}`).join(", ");
    const result = await db.query(
      `UPDATE notification_preferences SET ${setClause} WHERE user_id = $1 RETURNING *`,
      [req.userId, ...keys.map((k) => patch[k])]
    );
    res.json({ preferences: result.rows[0] });
  })
);

// ---- Storage usage (Settings > Storage donut) ----
router.get(
  "/me/storage",
  asyncRoute(async (req, res) => {
    const byCategory = await db.query(
      `SELECT category, file_count, total_kb FROM storage_by_category WHERE user_id = $1`,
      [req.userId]
    );
    const user = await db.query(`SELECT storage_cap_kb FROM users WHERE id = $1`, [req.userId]);
    const usedKb = byCategory.rows.reduce((s, r) => s + Number(r.total_kb), 0);
    res.json({
      capKb: Number(user.rows[0].storage_cap_kb),
      usedKb,
      byCategory: byCategory.rows,
    });
  })
);

// ---- Data export (Settings > Export) ----
router.get(
  "/me/export",
  asyncRoute(async (req, res) => {
    const [user, collections, files, reminders] = await Promise.all([
      db.query(`SELECT id, name, email, created_at FROM users WHERE id = $1`, [req.userId]),
      db.query(`SELECT * FROM collections WHERE user_id = $1`, [req.userId]),
      db.query(`SELECT id, name, category, collection_id, size_kb, created_at, starred FROM files WHERE user_id = $1`, [req.userId]),
      db.query(`SELECT * FROM reminders WHERE user_id = $1`, [req.userId]),
    ]);
    await db.query(`INSERT INTO account_events (user_id, event_type) VALUES ($1, 'data_export')`, [req.userId]);
    res.json({
      user: user.rows[0],
      collections: collections.rows,
      files: files.rows,
      reminders: reminders.rows,
      exportedAt: new Date().toISOString(),
    });
  })
);

module.exports = router;
