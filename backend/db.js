const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL in .env / Render environment.");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });

// Neon can close idle connections; this stops the server from crashing when that happens.
pool.on("error", (err) => console.error("DB idle client error:", err.message));

module.exports = pool;