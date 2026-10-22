/* =========================================================
   AM MOTION LAB — payment backend (Razorpay)
   The Razorpay SECRET key exists ONLY here (via .env).
   It must never be copied into index.html / style.css / script.js.
   ========================================================= */
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const Razorpay = require("razorpay");
const pool = require("./db");

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "";
const PORT = process.env.PORT || 3000;

if (!KEY_ID || !KEY_SECRET || KEY_ID.startsWith("YOUR_") || KEY_SECRET.startsWith("YOUR_")) {
  console.error("Missing Razorpay credentials. Copy .env.example to .env and fill in RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  process.exit(1);
}

const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });

/* Authoritative prices (INR, whole rupees). The browser never decides the
   amount — it only sends courseId + levelId. KEEP IN SYNC with script.js. */
const PRICES = {
  "video-editing":     { basic: 1999,  advanced: 3999,  professional: 5999 },
  "2d-animation":      { basic: 6999,  advanced: 9999,  professional: 13999 },
  "graphic-designing": { basic: 1999,  advanced: 3999,  professional: 5999 },
  "motion-graphics":   { basic: 5999,  advanced: 7999,  professional: 11999 },
  "3d-animation":      { basic: 14999, advanced: 17999, professional: 24999 },
};
const getCoursePrice = (courseId, levelId) => {
  if (typeof courseId !== "string" || typeof levelId !== "string") return null;
  if (!Object.prototype.hasOwnProperty.call(PRICES, courseId)) return null;
  const levels = PRICES[courseId];
  return Object.prototype.hasOwnProperty.call(levels, levelId) ? levels[levelId] : null;
};

const app = express();
/* ---------- CORS: only our own websites may call this backend ---------- */
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Security headers for responses served through this Express service.
// GitHub Pages has separate response headers configured by GitHub.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://checkout.razorpay.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://am-motion-lab-9ui2.onrender.com https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://generativelanguage.googleapis.com https://*.razorpay.com",
  "frame-src https://accounts.google.com https://*.razorpay.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://*.razorpay.com",
  "frame-ancestors 'none'",
].join("; ");

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Report-only lets us observe CSP issues before enforcing a policy that
  // could interfere with the inline pages, Google sign-in, or Razorpay Checkout.
  res.setHeader("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);

  const forwardedProto = (req.get("x-forwarded-proto") || "").split(",")[0].trim();
  if (req.secure || forwardedProto === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

const ALLOWED_ORIGINS = [
  process.env.PUBLIC_SITE_ORIGIN || "https://funflip8434ankit-eng.github.io",
  ...(process.env.NODE_ENV === "production" ? [] : [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://localhost:3000",
  ]),
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") return res.sendStatus(204); // browser's "permission check"
  next();
});

// Razorpay signs the exact raw request body. Keep this route ahead of express.json().
const webhookLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});
app.post("/api/webhooks/razorpay", webhookLimiter, express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
  if (!WEBHOOK_SECRET) return res.status(503).json({ error: "Payment webhook is not configured." });
  const signature = req.get("x-razorpay-signature") || "";
  if (!Buffer.isBuffer(req.body) || !/^[a-f\d]{64}$/i.test(signature)) return res.status(400).json({ error: "Invalid webhook request." });

  const expected = crypto.createHmac("sha256", WEBHOOK_SECRET).update(req.body).digest("hex");
  const expectedBytes = Buffer.from(expected, "hex");
  const receivedBytes = Buffer.from(signature, "hex");
  if (expectedBytes.length !== receivedBytes.length || !crypto.timingSafeEqual(expectedBytes, receivedBytes)) {
    return res.status(400).json({ error: "Invalid webhook signature." });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString("utf8"));
  } catch (err) {
    return res.status(400).json({ error: "Invalid webhook payload." });
  }
  if (event.event !== "payment.captured") return res.json({ received: true });

  try {
    const payment = event.payload && event.payload.payment && event.payload.payment.entity;
    if (
      !payment || payment.status !== "captured" ||
      typeof payment.id !== "string" || !/^pay_[A-Za-z0-9]+$/.test(payment.id) || payment.id.length > 64 ||
      typeof payment.order_id !== "string" || !/^order_[A-Za-z0-9]+$/.test(payment.order_id) || payment.order_id.length > 64
    ) {
      return res.status(400).json({ error: "Invalid captured payment event." });
    }
    const order = await razorpay.orders.fetch(payment.order_id);
    const notes = order.notes || {};
    const price = getCoursePrice(notes.courseId, notes.levelId);
    const userId = Number(notes.userId);
    if (
      !Number.isInteger(userId) || userId < 1 || !price ||
      order.amount !== price * 100 || payment.amount !== order.amount ||
      payment.currency !== "INR" || payment.order_id !== order.id
    ) {
      console.error("payment webhook order mismatch:", payment.id);
      return res.status(400).json({ error: "Payment does not match the course order." });
    }

    await pool.query(
      `INSERT INTO enrollments (user_id, course_id, level_id, order_id, payment_id, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'paid')
       ON CONFLICT (payment_id) DO NOTHING`,
      [userId, notes.courseId, notes.levelId, order.id, payment.id]
    );
    res.json({ received: true });
  } catch (err) {
    console.error("payment webhook failed:", err && err.statusCode, err && err.message);
    res.status(500).json({ error: "Could not process payment webhook." });
  }
});

app.use(express.json({ limit: "10kb" }));
// Caps bursts across the API; login and checkout have stricter route limits too.
app.use("/api", rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait a little and try again." },
}));
app.use("/api/auth", require("./routes/auth"));
app.use("/api", require("./routes/google-email"));
app.use("/api/study", require("./routes/study"));
app.use("/api", require("./routes/payment")(razorpay, KEY_SECRET, PRICES));
app.use("/api/learning", require("./routes/learning"));

// Render can use this to check that both the API process and database are ready.
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok" });
  } catch (err) {
    console.error("health check failed:", err && err.message);
    res.status(503).json({ status: "error" });
  }
});

/* ---------- Serve the static website from the parent folder ----------
   The backend folder itself is blocked so .env can never be downloaded. */
app.use("/backend", (req, res) => res.status(404).end());
app.use(express.static(path.join(__dirname, ".."), { dotfiles: "deny" }));

pool.query(fs.readFileSync(path.join(__dirname, "course-schema.sql"), "utf8"))
  .then(() => app.listen(PORT, "0.0.0.0", () => console.log("AM Motion Lab listening on port " + PORT)))
  .catch((err) => {
    console.error("Could not prepare course progress tables:", err && err.message);
    process.exit(1);
  });
