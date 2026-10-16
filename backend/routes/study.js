const express = require("express");
const rateLimit = require("express-rate-limit");
const requireAuth = require("../middleware/requireAuth");
const { COURSES } = require("../curriculum");
const { generateStudyAnswer } = require("../study-assistant");

const router = express.Router();
const askLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "You have reached the study assistant limit. Please try again later." },
});

router.post("/ask", askLimiter, requireAuth, async (req, res) => {
  const body = req.body || {};
  const question = String(body.question || "").trim();
  const courseId = body.courseId ? String(body.courseId) : "";
  const history = body.history;

  if (question.length < 2 || question.length > 1200) {
    return res.status(400).json({ error: "Please enter a question between 2 and 1,200 characters." });
  }
  if (courseId && !COURSES[courseId]) return res.status(400).json({ error: "Unknown course." });
  if (history !== undefined && !Array.isArray(history)) return res.status(400).json({ error: "Invalid chat history." });
  const safeHistory = (Array.isArray(history) ? history : []).slice(-8);
  if (safeHistory.some((item) => !item || !["user", "model"].includes(item.role) || typeof item.text !== "string" || !item.text.trim() || item.text.length > 1200)) {
    return res.status(400).json({ error: "Invalid chat history." });
  }
  if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "The study assistant is not configured yet." });

  try {
    const result = await generateStudyAnswer(question, { courseId, history: safeHistory });
    res.json(result);
  } catch (err) {
    console.error("study assistant request failed:", err && err.message);
    res.status(502).json({ error: "The study assistant is temporarily unavailable. Please try again later." });
  }
});

module.exports = router;
