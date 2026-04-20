/**
 * Step 11 preflight — read-only checks before applying migration 00079.
 *
 * exec_sql RPC only returns {success:true} (no row data), so we use the
 * Supabase query builder for table reads and query pg catalogs by trial.
 *
 * Run: npx tsx --env-file=.env.local scripts/step11-preflight.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not found in environment");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function check3_statusDistribution() {
  console.log("\n== Check 3: admin_status distribution ==");
  const { data, error } = await admin.from("candidates").select("admin_status");
  if (error) {
    console.log("Error:", error.message);
    return;
  }
  const counts: Record<string, number> = {};
  for (const row of data as Array<{ admin_status: string | null }>) {
    const key = row.admin_status ?? "(null)";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  for (const [status, count] of sorted) {
    console.log(`  ${status}: ${count}`);
  }
  console.log(`  TOTAL: ${data.length}`);
}

async function check4_speakingLevelColumnExists() {
  console.log("\n== Check 4: speaking_level column on candidates ==");
  // Functional test: attempt to SELECT just that column, limit 0.
  // If column does not exist, PostgREST returns an error containing "column ... does not exist".
  const { error } = await admin.from("candidates").select("speaking_level").limit(1);
  if (error) {
    console.log(`  NOT PRESENT — error: ${error.message}`);
  } else {
    console.log(`  PRESENT (SELECT succeeded)`);
  }
}

async function check4b_speakingLevelUpdatedToExists() {
  console.log("\n== Check 4b: speaking_level_updated_to column on candidate_interviews ==");
  const { error } = await admin.from("candidate_interviews").select("speaking_level_updated_to").limit(1);
  if (error) {
    console.log(`  NOT PRESENT — error: ${error.message}`);
  } else {
    console.log(`  PRESENT (SELECT succeeded)`);
  }
}

async function check5_enumValues() {
  console.log("\n== Check 5: enum values ==");

  // Probe speaking_level_type by running a cast via exec_sql.
  // We invoke a one-off SQL that creates a temp function, runs the query,
  // and captures the result in a server-side table we can SELECT back.
  // Simpler approach: test each known enum value with a cast via PostgREST.
  // Since we cannot get catalog rows back, we probe functionally.

  console.log("\n  -- speaking_level_type probe (attempt cast of known value) --");
  // Try to insert a row with speaking_level='fluent' to a throwaway temp table check
  // Actually simplest: query the type via Supabase types API is not exposed.
  // Instead: use check4 result as indirect signal — if column exists, type exists (usually).

  console.log("  (No catalog access via PostgREST. See check 4 result above — column presence implies type presence.)");

  console.log("\n  -- admin_status_type probe --");
  // Test admin_status_type values by attempting to filter candidates on each
  for (const value of [
    "pending_2nd_interview",
    "pending_speaking_review",
    "pending_review",
    "ai_interview_failed",
    "approved",
    "pending_final_review",  // should not exist
    "active",                 // should not exist per Step 5.5 audit
    "profile_review",         // should not exist per Step 5.5 audit
    "rejected",               // should not exist per Step 5.5 audit
  ]) {
    const { error, count } = await admin
      .from("candidates")
      .select("*", { count: "exact", head: true })
      .eq("admin_status", value);
    if (error) {
      // error on invalid enum value = type does not include this value
      console.log(`  ${value}: INVALID (${error.message})`);
    } else {
      console.log(`  ${value}: valid enum value, count=${count}`);
    }
  }
}

async function check6_rpcSignature() {
  console.log("\n== Check 6: get_candidates_with_skills RPC signature ==");
  // PostgREST doesn't directly expose pg_proc. However, we can attempt to call
  // the RPC with NO args and observe the error message — PostgREST typically
  // returns a helpful error listing the expected signature on mismatch.
  const { data, error } = await admin.rpc("get_candidates_with_skills", {});
  if (error) {
    console.log("  Error (expected — reveals signature):");
    console.log(`    code: ${error.code}`);
    console.log(`    message: ${error.message}`);
    console.log(`    hint: ${(error as { hint?: string }).hint ?? "(none)"}`);
    console.log(`    details: ${(error as { details?: string }).details ?? "(none)"}`);
  } else {
    console.log(`  No-arg call returned data of length: ${Array.isArray(data) ? data.length : "not-array"}`);
  }

  // Also read the migration 00043 body locally as the source of truth for rewrite
  console.log("\n  NOTE: PostgREST does not expose pg_proc. The function BODY for rewriting Operation 7");
  console.log("  will be taken from supabase/migrations/00043_skills_rpc.sql (source of truth).");
}

async function main() {
  console.log("════════════════════════════════════════════");
  console.log("Step 11 Preflight — READ-ONLY checks");
  console.log(`DB: ${SUPABASE_URL}`);
  console.log("════════════════════════════════════════════");

  await check3_statusDistribution();
  await check4_speakingLevelColumnExists();
  await check4b_speakingLevelUpdatedToExists();
  await check5_enumValues();
  await check6_rpcSignature();

  console.log("\n════════════════════════════════════════════");
  console.log("Preflight complete.");
  console.log("════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
