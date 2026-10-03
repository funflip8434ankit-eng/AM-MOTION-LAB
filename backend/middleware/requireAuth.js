const jwt = require("jsonwebtoken");

// Guard: lets a request through only if it carries a valid login token.
module.exports = function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "Please log in." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    req.user = { id: Number(payload.sub) };
    next();
  } catch (e) {
    res.status(401).json({ error: "Session expired. Please log in again." });
  }
};