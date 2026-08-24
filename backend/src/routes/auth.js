const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const { signToken, requireAuth } = require("../middleware/auth");
const { asyncRoute } = require("../middleware/errorHandler");

const router = express.Router();

function initials(name) {
  return (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "U";
}

router.post(
  "/signup",
  asyncRoute(async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await db.query(
      `INSERT INTO users (name, email, password_hash, avatar_initials)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, avatar_initials, avatar_color, plan, storage_cap_kb, theme, show_hidden, created_at`,
      [name, email.toLowerCase(), passwordHash, initials(name)]
    );
    const user = userResult.rows[0];

    await db.query(`INSERT INTO notification_preferences (user_id) VALUES ($1)`, [user.id]);
    await db.query(
      `INSERT INTO collections (user_id, name, description, icon, color, keywords)
       VALUES ($1, 'Getting Started', 'Your first collection — rename or delete it any time.', '📁', 'sage', '{}')`,
      [user.id]
    );
    await db.query(
      `INSERT INTO notifications (user_id, kind, title, body)
       VALUES ($1, 'security', 'Welcome to LifeGraph', 'Your vault has been created.')`,
      [user.id]
    );

    const token = signToken(user.id);
    res.status(201).json({ token, user });
  })
);

router.post(
  "/login",
  asyncRoute(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "email and password are required" });

    const result = await db.query(`SELECT * FROM users WHERE email = $1`, [email.toLowerCase()]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: "Invalid email or password" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    await db.query(
      `INSERT INTO account_events (user_id, event_type) VALUES ($1, 'login')`,
      [user.id]
    );

    delete user.password_hash;
    const token = signToken(user.id);
    res.json({ token, user });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `SELECT id, name, email, avatar_initials, avatar_color, plan, storage_cap_kb, theme, show_hidden, created_at
       FROM users WHERE id = $1`,
      [req.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ user: result.rows[0] });
  })
);

module.exports = router;
