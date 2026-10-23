const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "test-only-secret-with-more-than-thirty-two-characters";
process.env.NODE_ENV = "test";

const user = { id: 41, name: "Security Test Student", email: "security-test@example.com", phone: "8873181698", password_hash: null };
let sentOtp = "";
let enrollment = null;
let order = null;
let payment = null;

const pool = {
  async query(sql, params = []) {
    if (sql.startsWith("INSERT INTO users")) {
      Object.assign(user, { name: params[0], email: params[1], phone: params[2], password_hash: params[3] });
      return { rows: [{ id: user.id, name: user.name, email: user.email, phone: user.phone }] };
    }
    if (sql.includes("AS cooldown FROM login_otps")) return { rows: [] };
    if (sql.includes("INSERT INTO login_otps")) return { rows: [] };
    if (sql.includes("FROM users u JOIN login_otps")) {
      const hash = crypto.createHmac("sha256", process.env.JWT_SECRET).update(user.id + ":" + sentOtp).digest("hex");
      return params[0] === user.email ? { rows: [{
        id: user.id, name: user.name, email: user.email, phone: user.phone,
        code_hash: hash, expires_at: new Date(Date.now() + 60000), attempts: 0,
      }] } : { rows: [] };
    }
    if (sql.startsWith("DELETE FROM login_otps")) return { rowCount: 1, rows: [{ user_id: user.id }] };
    if (sql.startsWith("SELECT id, name, email, phone FROM users WHERE id = $1")) {
      return { rows: [{ id: user.id, name: user.name, email: user.email, phone: user.phone }] };
    }
    if (sql.includes("SELECT level_id FROM enrollments")) {
      return { rows: enrollment && enrollment.userId === params[0] && enrollment.courseId === params[1]
        ? [{ level_id: enrollment.levelId }] : [] };
    }
    if (sql.includes("SELECT lesson_id FROM lesson_completions")) return { rows: [] };
    if (sql.includes("FROM certificates WHERE user_id")) return { rows: [] };
    if (sql.startsWith("INSERT INTO enrollments")) {
      enrollment = { userId: params[0], courseId: params[1], levelId: params[2] };
      return { rowCount: 1, rows: [] };
    }
    throw new Error("Unexpected SQL in security-flow test: " + sql.slice(0, 100));
  },
  async connect() { throw new Error("No transaction expected in this test."); },
};

const dbPath = require.resolve("../db");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: pool };
const mailPath = require.resolve("../routes/google-email");
require.cache[mailPath] = {
  id: mailPath, filename: mailPath, loaded: true,
  exports: {
    sendLoginOtp: async (_email, _name, code) => { sentOtp = code; },
    sendPasswordResetOtp: async () => {},
  },
};

const authRoutes = require("../routes/auth");
const paymentRoutes = require("../routes/payment");
const learningRoutes = require("../routes/learning");
const studyRoutes = require("../routes/study");
const keySecret = "razorpay-test-secret";
const prices = { "video-editing": { basic: 1999, advanced: 3999, professional: 5999 } };
const razorpay = {
  orders: {
    async create(data) { order = { id: "order_securityflow01", amount: data.amount, currency: data.currency, notes: data.notes }; return order; },
    async fetch() { return order; },
  },
  payments: { async fetch() { return payment; } },
};

const app = express();
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api", paymentRoutes(razorpay, keySecret, prices));
app.use("/api/learning", learningRoutes);
app.use("/api/study", studyRoutes);

test("student registration through paid course access and IDOR denial", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve())));
  const base = "http://127.0.0.1:" + server.address().port;

  let response = await fetch(base + "/api/learning/courses/video-editing?levelId=basic");
  assert.equal(response.status, 401, "logged-out visitor is rejected");

  response = await fetch(base + "/api/auth/register", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: user.name, email: user.email, phone: user.phone, password: "StrongPass123!" }),
  });
  assert.equal(response.status, 201);
  assert.ok(sentOtp, "verification email adapter was called");

  response = await fetch(base + "/api/auth/login/verify-otp", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: user.email, code: sentOtp }),
  });
  assert.equal(response.status, 200);
  const session = await response.json();
  const headers = { authorization: "Bearer " + session.token, "content-type": "application/json" };

  const staleIssuedAt = Math.floor((Date.now() - 25 * 60 * 60 * 1000) / 1000);
  const staleToken = jwt.sign({ sub: user.id, iat: staleIssuedAt }, process.env.JWT_SECRET, { expiresIn: "7d" });
  response = await fetch(base + "/api/learning/courses/video-editing?levelId=basic", {
    headers: { authorization: "Bearer " + staleToken },
  });
  assert.equal(response.status, 401, "tokens older than 24 hours are rejected");

  response = await fetch(base + "/api/learning/courses/__proto__/lessons/anything/complete", {
    method: "POST", headers, body: JSON.stringify({ levelId: "constructor" }),
  });
  assert.equal(response.status, 400, "prototype properties cannot be used as course or level IDs");

  response = await fetch(base + "/api/study/ask", {
    method: "POST", headers, body: JSON.stringify({ question: "Please help", courseId: "constructor" }),
  });
  assert.equal(response.status, 400, "study endpoint rejects inherited course properties");

  response = await fetch(base + "/api/learning/courses/video-editing?levelId=basic", { headers });
  assert.equal(response.status, 403, "student has no course access before payment");

  response = await fetch(base + "/api/create-order", {
    method: "POST", headers, body: JSON.stringify({ courseId: "video-editing", levelId: "basic" }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).amount, 199900, "backend sets authoritative price in paise");

  response = await fetch(base + "/api/create-order", {
    method: "POST", headers, body: JSON.stringify({ courseId: "__proto__", levelId: "basic" }),
  });
  assert.equal(response.status, 400, "unknown course identifiers cannot select arbitrary prices");

  payment = { id: "pay_securityflow01", order_id: order.id, amount: order.amount, currency: "INR", status: "captured" };
  const signature = crypto.createHmac("sha256", keySecret).update(order.id + "|" + payment.id).digest("hex");
  response = await fetch(base + "/api/verify-payment", {
    method: "POST", headers,
    body: JSON.stringify({ razorpay_order_id: order.id, razorpay_payment_id: payment.id, razorpay_signature: "invalid" }),
  });
  assert.equal(response.status, 400, "malformed payment signatures are rejected");

  payment.currency = "USD";
  response = await fetch(base + "/api/verify-payment", {
    method: "POST", headers,
    body: JSON.stringify({ razorpay_order_id: order.id, razorpay_payment_id: payment.id, razorpay_signature: signature }),
  });
  assert.equal(response.status, 400, "payment with the wrong currency is rejected");
  assert.equal(enrollment, null, "rejected payment creates no enrollment");

  payment.currency = "INR";
  payment.status = "authorized";
  response = await fetch(base + "/api/verify-payment", {
    method: "POST", headers,
    body: JSON.stringify({ razorpay_order_id: order.id, razorpay_payment_id: payment.id, razorpay_signature: signature }),
  });
  assert.equal(response.status, 400, "authorized but uncaptured payment does not unlock a course");
  assert.equal(enrollment, null);

  payment.status = "captured";
  response = await fetch(base + "/api/verify-payment", {
    method: "POST", headers,
    body: JSON.stringify({ razorpay_order_id: order.id, razorpay_payment_id: payment.id, razorpay_signature: signature }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).verified, true);

  response = await fetch(base + "/api/learning/courses/video-editing?levelId=basic", { headers });
  assert.equal(response.status, 200, "purchaser can open the course");
  assert.equal((await response.json()).courseId, "video-editing");

  const otherStudentToken = jwt.sign({ sub: 42 }, process.env.JWT_SECRET, { expiresIn: "1h" });
  response = await fetch(base + "/api/learning/courses/video-editing?levelId=basic", {
    headers: { authorization: "Bearer " + otherStudentToken },
  });
  assert.equal(response.status, 403, "another student cannot access the purchaser's enrollment");
});
