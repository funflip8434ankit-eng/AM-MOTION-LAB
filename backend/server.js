/* =========================================================
   AM MOTION LAB — payment backend (Razorpay)
   The Razorpay SECRET key exists ONLY here (via .env).
   It must never be copied into index.html / style.css / script.js.
   ========================================================= */
require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const Razorpay = require("razorpay");

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
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

const app = express();
/* ---------- CORS: only our own websites may call this backend ---------- */
app.set("trust proxy", 1);
const ALLOWED_ORIGINS = [
  "https://funflip8434ankit-eng.github.io", // live website (GitHub Pages)
  "http://127.0.0.1:5500",                  // VS Code Live Server (testing)
  "http://localhost:5500",
  "http://localhost:3000",                  // local backend (testing)
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
app.use(express.json({ limit: "10kb" }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api", require("./routes/payment")(razorpay, KEY_SECRET, PRICES));
/* ---------- 1. Create order ---------- */
app.post("/api/create-order", async (req, res) => {
  try {
    const { courseId, levelId, student } = req.body || {};
    const price = PRICES[courseId] && PRICES[courseId][levelId];
    if (!price) return res.status(400).json({ error: "Invalid course or level." });

    const name = String((student && student.name) || "").trim();
    const email = String((student && student.email) || "").trim();
    const phone = String((student && student.phone) || "").trim();
    if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: "Invalid student details." });
    }

    const order = await razorpay.orders.create({
      amount: price * 100, // paise
      currency: "INR",
      receipt: "amml_" + Date.now(),
      notes: { courseId, levelId, studentName: name.slice(0, 100), studentEmail: email.slice(0, 100), studentPhone: phone },
    });

    res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
  } catch (err) {
    console.error("create-order failed:", err && err.statusCode, err && err.error && err.error.description);
    res.status(500).json({ error: "Could not create order." });
  }
});

/* ---------- 2. Verify payment signature ---------- */
app.post("/api/verify-payment", async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every((v) => typeof v === "string" && v)) {
    return res.status(400).json({ verified: false });
  }

  const expected = crypto
    .createHmac("sha256", KEY_SECRET)
    .update(razorpay_order_id + "|" + razorpay_payment_id)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(razorpay_signature);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) return res.status(400).json({ verified: false });

  // ---- TODO (fulfilment): the payment is genuine from this point. ----
  // Fetch the order to read the course/student saved in `notes`, then
  // record the enrolment (database / Google Sheet) and/or email the student.
  //   const order = await razorpay.orders.fetch(razorpay_order_id);
  //   saveEnrolment({ ...order.notes, paymentId: razorpay_payment_id });
  console.log("Payment verified:", razorpay_payment_id, "for order", razorpay_order_id);

  res.json({ verified: true });
});

/* ---------- 3. (Recommended) Webhook ----------
   Configure a webhook in the Razorpay Dashboard for `payment.captured` /
   `order.paid` and verify it with X-Razorpay-Signature + a webhook secret.
   This confirms enrolments even if the student closes the tab after paying. */

/* ---------- Serve the static website from the parent folder ----------
   The backend folder itself is blocked so .env can never be downloaded. */
app.use("/backend", (req, res) => res.status(404).end());
app.use(express.static(path.join(__dirname, ".."), { dotfiles: "deny" }));

app.listen(PORT, () => console.log("AM Motion Lab running at http://localhost:" + PORT));
