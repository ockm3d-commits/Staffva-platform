/**
 * Run: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-reassignment.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  "https://mshnsbblwgcpwuxwuevp.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Running recruiter_reassignment migration...");
  const sql = readFileSync("supabase/migrations/00063_recruiter_reassignment.sql", "utf-8");
  const { error } = await supabase.rpc("exec_sql", { query: sql });
  if (error) { console.error("Migration failed:", error.message); process.exit(1); }
  console.log("✓ Migration complete — recruiter_reassignment_log, is_active, priority added");
}

run().catch(console.error);
