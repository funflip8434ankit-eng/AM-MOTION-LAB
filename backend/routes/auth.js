const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const pool = require("../db");
const requireAuth = require("../middleware/requireAuth");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error("JWT_SECRET is missing or too short. Add it to .env / Render environment.");
  process.exit(1);
}

const router = express.Router();

// Stops someone from trying thousands of passwords.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again after some time." },
});

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);
const signToken = (userId) => jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone });

/* ---------- Register ---------- */
router.post("/register", limiter, async (req, res) => {
  try {
    const b = req.body || {};
    const name = String(b.name || "").trim();
    const email = String(b.email || "").trim().toLowerCase();
    let phone = String(b.phone || "").replace(/[\s-]/g, "");
    phone = phone.replace(/^(\+91|91|0)(?=[6-9]\d{9}$)/, "");
    const password = String(b.password || "");

    if (name.length < 2 || name.length > 100) return res.status(400).json({ error: "Please enter your full name." });
    if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Please enter a valid email." });
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: "Please enter a valid 10-digit phone number." });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be 8 to 72 characters." });
    if (b.confirmPassword !== undefined && b.confirmPassword !== password) return res.status(400).json({ error: "Passwords do not match." });

    const hash = await bcrypt.hash(password, 12);
    let user;
    try {
      const r = await pool.query(
        "INSERT INTO users (name, email, phone, password_hash) VALUES ($1,$2,$3,$4) RETURNING id, name, email, phone",
        [name, email, phone, hash]
      );
      user = r.rows[0];
    } catch (e) {
      if (e.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
      throw e;
    }
    res.status(201).json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    console.error("register failed:", err && err.message);
    res.status(500).json({ error: "Could not create account. Please try again." });
  }
});

/* ---------- Login ---------- */
router.post("/login", limiter, async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    const r = await pool.query("SELECT id, name, email, phone, password_hash FROM users WHERE email = $1", [email]);
    const user = r.rows[0];
    const ok = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: "Invalid email or password." });
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    console.error("login failed:", err && err.message);
    res.status(500).json({ error: "Could not log in. Please try again." });
  }
});

/* ---------- Who am I (account + purchased courses) ---------- */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const u = await pool.query("SELECT id, name, email, phone, created_at FROM users WHERE id = $1", [req.user.id]);
    if (!u.rows[0]) return res.status(401).json({ error: "Please log in again." });
    const e = await pool.query(
      "SELECT course_id, level_id, purchase_date FROM enrollments WHERE user_id = $1 AND payment_status = 'paid' ORDER BY purchase_date DESC",
      [req.user.id]
    );
    res.json({
      user: u.rows[0],
      enrollments: e.rows.map((x) => ({ courseId: x.course_id, levelId: x.level_id, purchaseDate: x.purchase_date })),
    });
  } catch (err) {
    console.error("me failed:", err && err.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

module.exports = router;