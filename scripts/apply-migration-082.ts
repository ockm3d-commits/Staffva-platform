/**
 * Apply migration 00082 — harden google calendar match.
 *
 * Adds attendee_email + unmatch_reason to calendar_unmatched_bookings,
 * deduplicates existing rows, enforces UNIQUE(recruiter_id, event_id),
 * and adds candidates.assigned_recruiter_at with backfill from
 * ai_interview_completed_at. Idempotent end-to-end.
 *
 * Run: npx tsx --env-file=.env.local scripts/apply-migration-082.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not found in environment");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

async function main() {
  const migrationPath = join(
    process.cwd(),
    "supabase/migrations/00082_harden_calendar_match.sql"
  );
  console.log("════════════════════════════════════════════════════════════");
  console.log("Applying migration 00082 — harden google calendar match");
  console.log(`File: ${migrationPath}`);
  console.log(`DB:   ${SUPABASE_URL}`);
  console.log("════════════════════════════════════════════════════════════");

  const sql = readFileSync(migrationPath, "utf-8");
  console.log(`SQL size: ${sql.length} bytes, ${sql.split("\n").length} lines`);
  console.log("\nSending full SQL to exec_sql RPC (single transaction)...\n");

  const startedAt = Date.now();
  const { data, error } = await admin.rpc("exec_sql", { query: sql });
  const elapsedMs = Date.now() - startedAt;

  if (error) {
    console.log("MIGRATION FAILED — transport error (transaction rolled back)\n");
    console.log(`  code:    ${error.code}`);
    console.log(`  message: ${error.message}`);
    console.log(`  hint:    ${(error as { hint?: string }).hint ?? "(none)"}`);
    console.log(`  details: ${(error as { details?: string }).details ?? "(none)"}`);
    console.log(`\nElapsed: ${elapsedMs}ms`);
    process.exit(1);
  }

  if (
    data &&
    typeof data === "object" &&
    "success" in data &&
    (data as { success: boolean }).success === false
  ) {
    console.log("MIGRATION FAILED — exec_sql returned failure (rolled back)\n");
    console.log(`RPC response: ${JSON.stringify(data, null, 2)}`);
    console.log(`\nElapsed: ${elapsedMs}ms`);
    process.exit(1);
  }

  console.log("MIGRATION APPLIED successfully");
  console.log(`Elapsed: ${elapsedMs}ms`);
  console.log(`RPC response: ${JSON.stringify(data)}\n`);

  // ─── Post-apply verification ──────────────────────────────────────
  console.log("────── Verification ──────");

  const probes: Array<{ table: string; column: string; expect: "EXISTS" }> = [
    { table: "calendar_unmatched_bookings", column: "attendee_email", expect: "EXISTS" },
    { table: "calendar_unmatched_bookings", column: "unmatch_reason", expect: "EXISTS" },
    { table: "candidates", column: "assigned_recruiter_at", expect: "EXISTS" },
  ];
  for (const p of probes) {
    const { error: e } = await admin.from(p.table).select(p.column).limit(1);
    const status = e ? `MISSING (${e.message})` : "EXISTS";
    console.log(`  ${p.table}.${p.column}: ${status}`);
  }

  // Row counts: duplicates collapsed + backfill completeness
  const { count: unmatchedCount } = await admin
    .from("calendar_unmatched_bookings")
    .select("*", { count: "exact", head: true });
  console.log(`\n  calendar_unmatched_bookings row count: ${unmatchedCount} (was 4003 pre-migration)`);

  const { count: assignedWithTs } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .not("assigned_recruiter", "is", null)
    .not("assigned_recruiter_at", "is", null);
  const { count: assignedTotal } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .not("assigned_recruiter", "is", null);
  console.log(`  candidates with assigned_recruiter: ${assignedTotal}, of which ${assignedWithTs} have assigned_recruiter_at backfilled`);

  // Distinct (recruiter_id, event_id) pairs should equal total row count now
  const { data: sample } = await admin
    .from("calendar_unmatched_bookings")
    .select("recruiter_id, event_id");
  if (sample) {
    const set = new Set(sample.map((r) => `${r.recruiter_id}::${r.event_id}`));
    console.log(`  distinct (recruiter_id, event_id) pairs: ${set.size} (should equal row count)`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
