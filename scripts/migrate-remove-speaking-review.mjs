/**
 * Run: SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/migrate-remove-speaking-review.mjs
 *
 * Removes 'pending_speaking_review' from admin_status_type enum.
 * Replaces with 'pending_2nd_interview' or 'pending_review' based on second interview state.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const supabase = createClient(
  "https://mshnsbblwgcpwuxwuevp.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  // Pre-check: count candidates still on the old status
  const { data: before, error: countErr } = await supabase
    .from("candidates")
    .select("id, second_interview_status", { count: "exact" })
    .eq("admin_status", "pending_speaking_review");

  if (countErr) {
    console.error("Pre-check failed:", countErr.message);
    process.exit(1);
  }

  console.log(`Found ${before?.length ?? 0} candidates with pending_speaking_review`);
  if (before?.length) {
    const completed = before.filter(c => c.second_interview_status === "completed").length;
    const other = before.length - completed;
    console.log(`  → ${completed} will become pending_review`);
    console.log(`  → ${other} will become pending_2nd_interview`);
  }

  // Run migration
  console.log("\nRunning migration 00066_remove_pending_speaking_review...");
  const sql = readFileSync("supabase/migrations/00066_remove_pending_speaking_review.sql", "utf-8");
  const { error } = await supabase.rpc("exec_sql", { query: sql });
  if (error) {
    console.error("Migration failed:", error.message);
    process.exit(1);
  }

  // Post-check: confirm zero records remain
  const { data: after, error: afterErr } = await supabase
    .from("candidates")
    .select("id", { count: "exact" })
    .eq("admin_status", "pending_speaking_review");

  if (afterErr) {
    // Expected — the enum value no longer exists, so this query will fail
    console.log("✓ Post-check: 'pending_speaking_review' no longer exists in enum (query correctly rejected)");
  } else if (after?.length === 0) {
    console.log("✓ Post-check: zero candidates with pending_speaking_review");
  } else {
    console.error("✗ Post-check FAILED: still found candidates with pending_speaking_review");
    process.exit(1);
  }

  console.log("✓ Migration complete — pending_speaking_review removed from admin_status_type");
}

run().catch(console.error);
