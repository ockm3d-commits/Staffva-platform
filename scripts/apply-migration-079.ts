/**
 * Apply migration 00079 — drop speaking_level/spoken_english columns,
 * consolidate admin_status enum, rebuild get_candidates_with_skills RPC.
 *
 * Reads the full SQL file and sends it to the exec_sql RPC as a single
 * payload so the BEGIN/COMMIT transaction in the file is preserved
 * (any step failing rolls back the entire migration).
 *
 * Run: npx tsx --env-file=.env.local scripts/apply-migration-079.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY not found in environment");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const migrationPath = join(
    process.cwd(),
    "supabase/migrations/00079_remove_speaking_level_and_consolidate_statuses.sql"
  );
  console.log("════════════════════════════════════════════════════════════");
  console.log("Applying migration 00079");
  console.log(`File: ${migrationPath}`);
  console.log(`DB:   ${SUPABASE_URL}`);
  console.log("════════════════════════════════════════════════════════════");

  const sql = readFileSync(migrationPath, "utf-8");
  console.log(`SQL size: ${sql.length} bytes, ${sql.split("\n").length} lines`);
  console.log("\nSending full SQL to exec_sql RPC (single transaction)...\n");

  const startedAt = Date.now();
  const { data, error } = await admin.rpc("exec_sql", { query: sql });
  const elapsedMs = Date.now() - startedAt;

  // 1. Transport-level error → RPC call itself failed
  if (error) {
    console.log("❌ MIGRATION FAILED — transport error (transaction rolled back)\n");
    console.log("Error details:");
    console.log(`  code:    ${error.code}`);
    console.log(`  message: ${error.message}`);
    console.log(`  hint:    ${(error as { hint?: string }).hint ?? "(none)"}`);
    console.log(`  details: ${(error as { details?: string }).details ?? "(none)"}`);
    console.log(`\nElapsed: ${elapsedMs}ms`);
    process.exit(1);
  }

  // 2. Body-level error — exec_sql returns {success:false, error, code} on PG errors
  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    (data as { success: boolean }).success === false
  ) {
    console.log("❌ MIGRATION FAILED — exec_sql returned failure (transaction rolled back)\n");
    console.log(`RPC response: ${JSON.stringify(data, null, 2)}`);
    console.log(`\nElapsed: ${elapsedMs}ms`);
    process.exit(1);
  }

  // 3. Success
  console.log("✅ MIGRATION APPLIED successfully");
  console.log(`Elapsed: ${elapsedMs}ms`);
  console.log(`RPC response: ${JSON.stringify(data)}`);
  console.log("\nRun phase-f verification next to confirm post-migration state.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
