require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "schema.sql"), "utf8");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  console.log("Applying schema.sql to", process.env.DATABASE_URL);
  try {
    await pool.query(sql);
    console.log("Schema applied successfully.");
  } catch (err) {
    console.error("Migration failed:", err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
