const express = require("express");
const crypto = require("crypto");
const pool = require("../db");
const requireAuth = require("../middleware/requireAuth");

const RANK = { basic: 1, advanced: 2, professional: 3 };

module.exports = function paymentRoutes(razorpay, KEY_SECRET, PRICES) {
  const router = express.Router();

  /* ---------- Create order (login required) ---------- */
  router.post("/create-order", requireAuth, async (req, res) => {
    try {
      const { courseId, levelId } = req.body || {};
      const price = PRICES[courseId] && PRICES[courseId][levelId];
      if (!price) return res.status(400).json({ error: "Invalid course or level." });

      const u = await pool.query("SELECT id, name, email, phone FROM users WHERE id = $1", [req.user.id]);
      const user = u.rows[0];
      if (!user) return res.status(401).json({ error: "Please log in again." });

      // Already owns this level (or a higher one)? Don't charge twice.
      const owned = await pool.query(
        "SELECT level_id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND payment_status = 'paid'",
        [user.id, courseId]
      );
      const best = owned.rows.reduce((m, r) => Math.max(m, RANK[r.level_id] || 0), 0);
      if (best >= RANK[levelId]) {
        return res.status(409).json({ error: "You already have access to this course level." });
      }

      const order = await razorpay.orders.create({
        amount: price * 100, // paise
        currency: "INR",
        receipt: "amml_" + Date.now(),
        notes: {
          userId: String(user.id),
          courseId,
          levelId,
          studentName: user.name.slice(0, 100),
          studentEmail: user.email.slice(0, 100),
          studentPhone: user.phone,
        },
      });
      res.json({ orderId: order.id, amount: order.amount, currency: order.currency });
    } catch (err) {
      console.error("create-order failed:", err && err.statusCode, err && err.error && err.error.description, err && err.message);
      res.status(500).json({ error: "Could not create order." });
    }
  });

  /* ---------- Verify payment + create enrollment (login required) ---------- */
  router.post("/verify-payment", requireAuth, async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
    if (![razorpay_order_id, razorpay_payment_id, razorpay_signature].every((v) => typeof v === "string" && v)) {
      return res.status(400).json({ verified: false });
    }

    // 1. Signature check (proves Razorpay sent this payment)
    const expected = crypto
      .createHmac("sha256", KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(razorpay_signature);
    if (!(a.length === b.length && crypto.timingSafeEqual(a, b))) {
      return res.status(400).json({ verified: false });
    }

    try {
      // 2. Ask Razorpay directly: what was ordered and what was paid?
      const [order, payment] = await Promise.all([
        razorpay.orders.fetch(razorpay_order_id),
        razorpay.payments.fetch(razorpay_payment_id),
      ]);
      const n = order.notes || {};
      const price = PRICES[n.courseId] && PRICES[n.courseId][n.levelId];
      const statusOk = payment.status === "captured" || payment.status === "authorized";

      if (
        !price ||
        String(n.userId) !== String(req.user.id) ||
        order.amount !== price * 100 ||
        payment.order_id !== razorpay_order_id ||
        payment.amount !== order.amount ||
        !statusOk
      ) {
        console.error("verify-payment mismatch for order", razorpay_order_id);
        return res.status(400).json({ verified: false });
      }

      // 3. Give the student access (same payment can never create two rows)
      await pool.query(
        `INSERT INTO enrollments (user_id, course_id, level_id, order_id, payment_id, payment_status)
         VALUES ($1, $2, $3, $4, $5, 'paid')
         ON CONFLICT (payment_id) DO NOTHING`,
        [req.user.id, n.courseId, n.levelId, razorpay_order_id, razorpay_payment_id]
      );

      console.log("Payment verified:", razorpay_payment_id, "user", req.user.id, n.courseId, n.levelId);
      res.json({ verified: true, courseId: n.courseId, levelId: n.levelId });
    } catch (err) {
      console.error("verify-payment failed:", err && err.statusCode, err && err.message);
      res.status(500).json({ verified: false });
    }
  });

  return router;
};