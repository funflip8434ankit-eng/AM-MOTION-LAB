const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const { verifyGoogleIdToken } = require("../google-verify");
const pool = require("../db");
const requireAuth = require("../middleware/requireAuth");
const emailSender = require("./google-email");
const sendLoginOtp = emailSender.sendLoginOtp;
const sendPasswordResetOtp = emailSender.sendPasswordResetOtp;

const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
if (!JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET.startsWith("REPLACE_")) {
  console.error("JWT_SECRET is missing or too short. Add it to .env / Render environment.");
  process.exit(1);
}

const router = express.Router();
const isValidEmail = (email) => email.length <= 150 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Stops someone from trying thousands of passwords.
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again after some time." },
});

const DUMMY_HASH = bcrypt.hashSync("dummy-password-for-timing", 12);
const signToken = (userId) => jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "24h" });
const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone });
const otpHash = (userId, code) => crypto.createHmac("sha256", JWT_SECRET).update(userId + ":" + code).digest("hex");

async function issueLoginOtp(user) {
  const existing = await pool.query(
    "SELECT sent_at > NOW() - INTERVAL '60 seconds' AS cooldown FROM login_otps WHERE user_id = $1",
    [user.id]
  );
  if (existing.rows[0] && existing.rows[0].cooldown) return { sent: true, throttled: true };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  const codeHash = otpHash(user.id, code);
  await pool.query(
    `INSERT INTO login_otps (user_id, code_hash, expires_at, sent_at, attempts)
     VALUES ($1, $2, NOW() + INTERVAL '10 minutes', NOW(), 0)
     ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
       expires_at = EXCLUDED.expires_at, sent_at = EXCLUDED.sent_at, attempts = 0`,
    [user.id, codeHash]
  );
  try {
    await sendLoginOtp(user.email, user.name, code);
    return { sent: true, throttled: false };
  } catch (err) {
    await pool.query("DELETE FROM login_otps WHERE user_id = $1 AND code_hash = $2", [user.id, codeHash]);
    throw err;
  }
}

async function finishOtpLogin(email, code, res) {
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ error: "Enter the 6-digit code sent to your email." });
  }
  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.phone, o.code_hash, o.expires_at, o.attempts
     FROM users u JOIN login_otps o ON o.user_id = u.id WHERE LOWER(u.email) = $1`,
    [email]
  );
  const row = result.rows[0];
  if (!row || row.attempts >= 5 || new Date(row.expires_at).getTime() <= Date.now()) {
    if (row) await pool.query("DELETE FROM login_otps WHERE user_id = $1", [row.id]);
    return res.status(401).json({ error: "That code is invalid or expired. Sign in again to get a new code." });
  }
  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(otpHash(row.id, code), "hex");
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    await pool.query("UPDATE login_otps SET attempts = attempts + 1 WHERE user_id = $1", [row.id]);
    return res.status(401).json({ error: "That code is incorrect. Check the email and try again." });
  }
  const consumed = await pool.query(
    "DELETE FROM login_otps WHERE user_id = $1 AND code_hash = $2 AND expires_at > NOW() AND attempts < 5 RETURNING user_id",
    [row.id, row.code_hash]
  );
  if (!consumed.rowCount) return res.status(401).json({ error: "That code is invalid or expired. Sign in again to get a new code." });
  const user = { id: row.id, name: row.name, email: row.email, phone: row.phone };
  return res.json({ token: signToken(user.id), user: publicUser(user) });
}

/* ---------- Google Sign-In ---------- */
router.get("/google/client-id", (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google Sign-In is not configured yet." });
  res.json({ clientId: GOOGLE_CLIENT_ID });
});

router.post("/google", limiter, async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: "Google Sign-In is not configured yet." });
  try {
    const credential = String((req.body && req.body.credential) || "");
    if (!credential || credential.length > 10000) return res.status(400).json({ error: "Invalid Google sign-in response." });

    const profile = await verifyGoogleIdToken(credential, GOOGLE_CLIENT_ID);
    const email = String(profile.email || "").trim().toLowerCase();
    const name = String(profile.name || "Student").trim().slice(0, 100);
    if (!profile.email_verified || !profile.sub || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) {
      return res.status(401).json({ error: "Google could not verify this account. Please try another account." });
    }

    let user = (await pool.query(
      "SELECT id, name, email, phone FROM users WHERE LOWER(email) = $1",
      [email]
    )).rows[0];

    if (!user) {
      try {
        const created = await pool.query(
          "INSERT INTO users (name, email, phone, password_hash) VALUES ($1, $2, NULL, NULL) RETURNING id, name, email, phone",
          [name || "Student", email]
        );
        user = created.rows[0];
      } catch (err) {
        // A concurrent first sign-in may have inserted the same email.
        if (err.code !== "23505") throw err;
        user = (await pool.query(
          "SELECT id, name, email, phone FROM users WHERE LOWER(email) = $1",
          [email]
        )).rows[0];
      }
    }
    if (!user) return res.status(500).json({ error: "Could not finish Google sign-in." });
    res.json({ token: signToken(user.id), user: publicUser(user) });
  } catch (err) {
    console.error("Google sign-in failed:", err && err.message);
    res.status(401).json({ error: "Google sign-in could not be verified. Please try again." });
  }
});

/* ---------- Register ---------- */
router.post("/register", limiter, async (req, res) => {
  let accountCreated = false;
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
      accountCreated = true;
    } catch (e) {
      if (e.code === "23505") return res.status(409).json({ error: "An account with this email already exists." });
      throw e;
    }
    await issueLoginOtp(user);
    res.status(201).json({ otpRequired: true, email: user.email });
  } catch (err) {
    console.error("register failed:", err && err.message);
    res.status(accountCreated ? 503 : 500).json({
      error: accountCreated
        ? "Your account was created, but we could not send the verification code. Please log in again to request a new code."
        : "Could not create account. Please try again.",
    });
  }
});

/* ---------- Login ---------- */
router.post("/login", limiter, async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    if (!isValidEmail(email) || password.length > 72) {
      return res.status(400).json({ error: "Invalid email or password." });
    }
    const r = await pool.query("SELECT id, name, email, phone, password_hash FROM users WHERE email = $1", [email]);
    const user = r.rows[0];
    const hash = user && user.password_hash ? user.password_hash : DUMMY_HASH;
    const ok = await bcrypt.compare(password, hash);
    if (!user || !user.password_hash || !ok) return res.status(401).json({ error: "Invalid email or password." });
    await issueLoginOtp(user);
    res.json({ otpRequired: true, email: user.email });
  } catch (err) {
    console.error("login failed:", err && err.message);
    res.status(503).json({ error: "Could not send your sign-in code. Please try again in a moment." });
  }
});

router.post("/login/verify-otp", limiter, async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const code = String((req.body && req.body.code) || "").trim();
    return await finishOtpLogin(email, code, res);
  } catch (err) {
    console.error("login OTP verification failed:", err && err.message);
    return res.status(500).json({ error: "Could not verify the code. Please try again." });
  }
});

router.post("/login/resend-otp", limiter, async (req, res) => {
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    const password = String((req.body && req.body.password) || "");
    if (!isValidEmail(email) || password.length > 72) return res.status(400).json({ error: "Please enter a valid email and password." });
    const result = await pool.query(
      "SELECT id, name, email, password_hash FROM users WHERE LOWER(email) = $1",
      [email]
    );
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user && user.password_hash ? user.password_hash : DUMMY_HASH);
    if (!user || !user.password_hash || !ok) return res.status(401).json({ error: "Please return to sign in and enter your password again." });
    const issued = await issueLoginOtp(user);
    const message = issued.throttled
      ? "A code was sent recently. Check your inbox, or wait one minute before requesting another."
      : "A new sign-in code has been sent. Check your inbox.";
    return res.json({ sent: true, message });
  } catch (err) {
    console.error("login OTP resend failed:", err && err.message);
    return res.status(503).json({ error: "Could not resend the code. Please try again in a moment." });
  }
});

/* ---------- Password reset by email code ---------- */
router.post("/password/forgot", limiter, async (req, res) => {
  const generic = { sent: true, message: "If an account exists for that email, a reset code has been sent." };
  try {
    const email = String((req.body && req.body.email) || "").trim().toLowerCase();
    if (!isValidEmail(email)) return res.status(400).json({ error: "Please enter a valid email." });
    const result = await pool.query("SELECT id, name, email, password_hash FROM users WHERE LOWER(email) = $1", [email]);
    const user = result.rows[0];
    if (!user || !user.password_hash) return res.json(generic);
    const cooldown = await pool.query(
      "SELECT sent_at > NOW() - INTERVAL '60 seconds' AS active FROM password_reset_otps WHERE user_id = $1", [user.id]
    );
    if (cooldown.rows[0] && cooldown.rows[0].active) return res.json(generic);
    const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
    const codeHash = otpHash(user.id, code);
    await pool.query(
      `INSERT INTO password_reset_otps (user_id, code_hash, expires_at, sent_at, attempts)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes', NOW(), 0)
       ON CONFLICT (user_id) DO UPDATE SET code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at, sent_at = EXCLUDED.sent_at, attempts = 0`,
      [user.id, codeHash]
    );
    try { await sendPasswordResetOtp(user.email, user.name, code); }
    catch (err) {
      await pool.query("DELETE FROM password_reset_otps WHERE user_id = $1 AND code_hash = $2", [user.id, codeHash]);
      throw err;
    }
    return res.json(generic);
  } catch (err) {
    console.error("password reset code send failed:", err && err.message);
    return res.status(503).json({ error: "Could not send a reset code right now. Please try again." });
  }
});

router.post("/password/reset", limiter, async (req, res) => {
  const email = String((req.body && req.body.email) || "").trim().toLowerCase();
  const code = String((req.body && req.body.code) || "").trim();
  const password = String((req.body && req.body.password) || "");
  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter your email and the 6-digit reset code." });
  if (password.length < 8 || password.length > 72) return res.status(400).json({ error: "Password must be 8 to 72 characters." });
  let client;
  try {
    const result = await pool.query(
      `SELECT u.id, o.code_hash, o.expires_at, o.attempts FROM users u
       JOIN password_reset_otps o ON o.user_id = u.id WHERE LOWER(u.email) = $1`, [email]
    );
    const row = result.rows[0];
    if (!row || row.attempts >= 5 || new Date(row.expires_at).getTime() <= Date.now()) {
      if (row) await pool.query("DELETE FROM password_reset_otps WHERE user_id = $1", [row.id]);
      return res.status(401).json({ error: "That code is invalid or expired. Request a new one." });
    }
    const expected = Buffer.from(row.code_hash, "hex");
    const actual = Buffer.from(otpHash(row.id, code), "hex");
    if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
      await pool.query("UPDATE password_reset_otps SET attempts = attempts + 1 WHERE user_id = $1", [row.id]);
      return res.status(401).json({ error: "That code is incorrect. Check the email and try again." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    client = await pool.connect();
    await client.query("BEGIN");
    const consumed = await client.query(
      "DELETE FROM password_reset_otps WHERE user_id = $1 AND code_hash = $2 AND expires_at > NOW() AND attempts < 5 RETURNING user_id",
      [row.id, row.code_hash]
    );
    if (!consumed.rowCount) {
      await client.query("ROLLBACK");
      return res.status(401).json({ error: "That code is invalid or expired. Request a new one." });
    }
    await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, row.id]);
    await client.query("DELETE FROM login_otps WHERE user_id = $1", [row.id]);
    await client.query("COMMIT");
    return res.json({ reset: true, message: "Password updated. You can now log in." });
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => {});
    console.error("password reset failed:", err && err.message);
    return res.status(500).json({ error: "Could not reset your password. Please try again." });
  } finally { if (client) client.release(); }
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
