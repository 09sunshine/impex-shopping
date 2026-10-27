import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pool } from "./connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations(): Promise<{ success: boolean; message: string }> {
  const candidatePaths = [
    path.resolve(__dirname, "schema.sql"),
    path.resolve(__dirname, "../../src/db/schema.sql"),
    path.resolve(process.cwd(), "src/db/schema.sql"),
    path.resolve(process.cwd(), "backend/src/db/schema.sql"),
  ];
  const sqlPath = candidatePaths.find((p) => fs.existsSync(p));
  if (!sqlPath) {
    throw new Error(`Schema file not found. Checked: ${candidatePaths.join(", ")}`);
  }

  const sql = fs.readFileSync(sqlPath, "utf-8");
  const client = await pool.connect();
  try {
    console.log("Running database migrations on PostgreSQL / Supabase...");
    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");
    console.log("Migrations applied successfully.");
    return { success: true, message: "Database schema applied successfully." };
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err.message);
    throw err;
  } finally {
    client.release();
  }
}

// If run directly via CLI (npm run db:migrate)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => {
      console.log("Migration complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration script error:", err);
      process.exit(1);
    });
}
