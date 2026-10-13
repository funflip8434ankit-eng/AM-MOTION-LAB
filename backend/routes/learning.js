const crypto = require("crypto");
const express = require("express");
const pool = require("../db");
const requireAuth = require("../middleware/requireAuth");
const { COURSES, LEVEL_RANK } = require("../curriculum");

const router = express.Router();
router.use(requireAuth);

async function getAccess(userId, courseId, levelId) {
  const course = COURSES[courseId];
  if (!course || !LEVEL_RANK[levelId]) return null;
  const result = await pool.query(
    "SELECT level_id FROM enrollments WHERE user_id = $1 AND course_id = $2 AND payment_status = 'paid'",
    [userId, courseId]
  );
  const highestRank = result.rows.reduce((highest, row) => Math.max(highest, LEVEL_RANK[row.level_id] || 0), 0);
  if (highestRank < LEVEL_RANK[levelId]) return null;
  return course;
}

async function getCertificate(userId, courseId, levelId) {
  const result = await pool.query(
    "SELECT id, certificate_number, student_name, course_name, level_id, issued_at FROM certificates WHERE user_id = $1 AND course_id = $2 AND level_id = $3",
    [userId, courseId, levelId]
  );
  return result.rows[0] || null;
}

router.get("/courses/:courseId", async (req, res) => {
  const { courseId } = req.params;
  const { levelId } = req.query;
  try {
    const course = await getAccess(req.user.id, courseId, levelId);
    if (!course) return res.status(403).json({ error: "No access to this course level." });

    const level = course.levels[levelId];
    const lessons = course.lessons.slice(0, level.lessonCount);
    const progressResult = await pool.query(
      "SELECT lesson_id FROM lesson_completions WHERE user_id = $1 AND course_id = $2",
      [req.user.id, courseId]
    );
    const completed = new Set(progressResult.rows.map((row) => row.lesson_id));
    const certificate = await getCertificate(req.user.id, courseId, levelId);

    res.json({
      courseId,
      courseName: course.name,
      overview: course.overview,
      levelId,
      levelName: level.name,
      lessons: lessons.map((lesson) => ({ ...lesson, completed: completed.has(lesson.id) })),
      completedCount: lessons.filter((lesson) => completed.has(lesson.id)).length,
      certificate,
    });
  } catch (err) {
    console.error("load course progress failed:", err && err.message);
    res.status(500).json({ error: "Could not load course progress." });
  }
});

router.post("/courses/:courseId/lessons/:lessonId/complete", async (req, res) => {
  const { courseId, lessonId } = req.params;
  const { levelId } = req.body || {};
  const course = COURSES[courseId];
  if (!course || !LEVEL_RANK[levelId]) return res.status(400).json({ error: "Invalid course or level." });

  const level = course.levels[levelId];
  const lessons = course.lessons.slice(0, level.lessonCount);
  if (!lessons.some((lesson) => lesson.id === lessonId)) {
    return res.status(400).json({ error: "Lesson is not part of this course level." });
  }

  const access = await getAccess(req.user.id, courseId, levelId).catch((err) => {
    console.error("check course access failed:", err && err.message);
    return false;
  });
  if (!access) return res.status(403).json({ error: "No access to this course level." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1::int, hashtext($2))", [req.user.id, courseId]);
    await client.query(
      "INSERT INTO lesson_completions (user_id, course_id, lesson_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [req.user.id, courseId, lessonId]
    );
    const completedResult = await client.query(
      "SELECT COUNT(*)::int AS count FROM lesson_completions WHERE user_id = $1 AND course_id = $2 AND lesson_id = ANY($3::text[])",
      [req.user.id, courseId, lessons.map((lesson) => lesson.id)]
    );

    let certificate = null;
    const completedCount = completedResult.rows[0].count;
    if (completedCount === lessons.length) {
      const userResult = await client.query("SELECT name FROM users WHERE id = $1", [req.user.id]);
      const studentName = userResult.rows[0].name;
      const certificateNumber = "AMML-" + new Date().getFullYear() + "-" + crypto.randomBytes(4).toString("hex").toUpperCase();
      const certificateResult = await client.query(
        `INSERT INTO certificates (user_id, course_id, level_id, student_name, course_name, certificate_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (user_id, course_id, level_id) DO UPDATE SET certificate_number = certificates.certificate_number
         RETURNING id, certificate_number, student_name, course_name, level_id, issued_at`,
        [req.user.id, courseId, levelId, studentName, course.name, certificateNumber]
      );
      certificate = certificateResult.rows[0];
    }

    await client.query("COMMIT");
    res.json({ completedCount, totalLessons: lessons.length, certificate });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("complete lesson failed:", err && err.message);
    res.status(500).json({ error: "Could not save lesson progress." });
  } finally {
    client.release();
  }
});

router.get("/certificates", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, course_id, level_id, course_name, certificate_number, issued_at FROM certificates WHERE user_id = $1 ORDER BY issued_at DESC",
      [req.user.id]
    );
    res.json({ certificates: result.rows });
  } catch (err) {
    console.error("load certificates failed:", err && err.message);
    res.status(500).json({ error: "Could not load certificates." });
  }
});

router.get("/certificates/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, course_id, level_id, student_name, course_name, certificate_number, issued_at FROM certificates WHERE id = $1 AND user_id = $2",
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Certificate not found." });
    res.json({ certificate: result.rows[0] });
  } catch (err) {
    console.error("load certificate failed:", err && err.message);
    res.status(500).json({ error: "Could not load certificate." });
  }
});

module.exports = router;