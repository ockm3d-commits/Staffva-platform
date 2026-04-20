/**
 * Reconcile stored calendar_unmatched_bookings rows against the hardened
 * match logic introduced in src/lib/google-calendar.ts. Any row whose
 * stored attendee_email now resolves to a single assigned candidate (and
 * passes all five safeguards) is linked; the unmatched row is then
 * deleted. Rows without a stored attendee_email cannot be reconciled
 * (old rows pre-dating the schema change) and are counted but skipped —
 * no name-based fallback is attempted by design.
 *
 * DRY-RUN by default. Pass --commit to actually write.
 *
 *   # dry run
 *   npx tsx --env-file=.env.local scripts/reconcile-unmatched-bookings.ts
 *
 *   # commit writes
 *   npx tsx --env-file=.env.local scripts/reconcile-unmatched-bookings.ts --commit
 */
import { createClient } from "@supabase/supabase-js";
import {
  decideMatchOutcome,
  type CalendarEvent,
  type CandidateMatchRow,
  type UnmatchReason,
} from "../src/lib/google-calendar";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY not found in environment");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY);
const COMMIT = process.argv.includes("--commit");

interface UnmatchedRow {
  id: string;
  recruiter_id: string | null;
  event_id: string;
  event_start: string | null;
  attendee_name: string | null;
  attendee_email: string | null;
  unmatch_reason: string | null;
  created_at: string | null;
}

// Pseudo-reason used only in the reconciliation report for rows that predate
// the attendee_email column. Not a true UnmatchReason — never written to the
// unmatch_reason column, only tallied in the summary tally.
type ReconcileSkipReason = "cannot_reconcile_no_email" | "event_not_confirmed_original" | "no_recruiter_id";

async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`Reconciling calendar_unmatched_bookings  [${COMMIT ? "COMMIT" : "DRY-RUN"}]`);
  console.log(`DB: ${SUPABASE_URL}`);
  console.log("══════════════════════════════════════════════════════════════\n");

  // Paginate past Supabase's 1000-row default cap.
  const PAGE_SIZE = 1000;
  const allRows: UnmatchedRow[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await admin
      .from("calendar_unmatched_bookings")
      .select("id, recruiter_id, event_id, event_start, attendee_name, attendee_email, unmatch_reason, created_at")
      .order("created_at", { ascending: true })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) { console.error("fetch error:", error); process.exit(1); }
    if (!data || data.length === 0) break;
    allRows.push(...(data as UnmatchedRow[]));
    if (data.length < PAGE_SIZE) break;
  }

  const tally = {
    scanned: allRows.length,
    with_email: 0,
    matched: 0,
    rejected_by_reason: {} as Record<string, number>,
  };
  const reconciled: Array<{ candidateId: string; candidateName: string; eventId: string; eventStart: string | null }> = [];
  const skipped: Array<{ rowId: string; reason: ReconcileSkipReason | UnmatchReason; detail: string }> = [];

  function tallyReject(reason: ReconcileSkipReason | UnmatchReason) {
    tally.rejected_by_reason[reason] = (tally.rejected_by_reason[reason] ?? 0) + 1;
  }

  for (const row of allRows) {
    // Skip rows with no recruiter — would widen the candidate query to all recruiters.
    if (!row.recruiter_id) {
      tallyReject("no_recruiter_id");
      skipped.push({ rowId: row.id, reason: "no_recruiter_id", detail: "recruiter_id is NULL" });
      continue;
    }

    // Skip rows whose original rejection was 'event_not_confirmed' — the stored
    // event was tentative/cancelled and we have no way to know its current status
    // without refetching from Google. A live webhook fire will re-evaluate.
    if (row.unmatch_reason === "event_not_confirmed") {
      tallyReject("event_not_confirmed_original");
      skipped.push({ rowId: row.id, reason: "event_not_confirmed_original", detail: "original rejection was E; requires live webhook re-eval" });
      continue;
    }

    if (!row.attendee_email) {
      tallyReject("cannot_reconcile_no_email");
      skipped.push({ rowId: row.id, reason: "cannot_reconcile_no_email", detail: `attendee_name='${row.attendee_name ?? "<null>"}'` });
      continue;
    }
    tally.with_email++;

    // Candidates whose email matches this attendee AND are assigned to the
    // same recruiter as the original event. Same scope as the webhook query.
    const { data: candidateMatches } = await admin
      .from("candidates")
      .select("id, email, display_name, full_name, created_at, ai_interview_completed_at, assigned_recruiter_at, second_interview_status, google_calendar_event_id")
      .eq("email", row.attendee_email)
      .eq("assigned_recruiter", row.recruiter_id);

    // Synthetic CalendarEvent — we only retain id, status, start from the
    // stored row, which is all decideMatchOutcome reads for B/C/D/E after A.
    const syntheticEvent: CalendarEvent = {
      id: row.event_id,
      status: "confirmed", // stored rows other than E already passed the cancel branch upstream
      start: row.event_start ? { dateTime: row.event_start } : undefined,
      attendees: [{ email: row.attendee_email }],
    };

    const decision = decideMatchOutcome({
      event: syntheticEvent,
      eventStart: row.event_start,
      externalEmails: [row.attendee_email],
      candidateMatches: (candidateMatches ?? []) as CandidateMatchRow[],
    });

    if (decision.kind === "unmatched") {
      tallyReject(decision.reason);
      skipped.push({ rowId: row.id, reason: decision.reason, detail: `email=${row.attendee_email}` });
      continue;
    }

    // Match! Look up display_name for the report.
    const candidate = (candidateMatches ?? []).find((c) => c.id === decision.candidateId) as
      | (CandidateMatchRow & { display_name?: string | null; full_name?: string | null })
      | undefined;
    const candidateName = candidate?.display_name || candidate?.full_name || decision.candidateEmail;

    if (COMMIT) {
      const { error: updErr } = await admin
        .from("candidates")
        .update({
          second_interview_status: "scheduled",
          second_interview_scheduled_at: row.event_start,
          google_calendar_event_id: row.event_id,
        })
        .eq("id", decision.candidateId);
      if (updErr) {
        console.error(`  [commit] UPDATE candidates failed for ${decision.candidateId}:`, updErr.message);
        skipped.push({ rowId: row.id, reason: "no_identifying_email", detail: `commit error: ${updErr.message}` });
        continue;
      }
      const { error: delErr } = await admin
        .from("calendar_unmatched_bookings")
        .delete()
        .eq("id", row.id);
      if (delErr) {
        console.error(`  [commit] DELETE calendar_unmatched_bookings row ${row.id} failed:`, delErr.message);
      }
    }

    tally.matched++;
    reconciled.push({
      candidateId: decision.candidateId,
      candidateName,
      eventId: row.event_id,
      eventStart: row.event_start,
    });

    if (decision.usedCreatedAtFloor) {
      console.warn(
        `  [safeguard-B] floor fell back to candidates.created_at for ${decision.candidateId} (${candidateName})`
      );
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n══════════════════ SUMMARY ══════════════════");
  console.log(`Mode:               ${COMMIT ? "COMMIT (writes applied)" : "DRY-RUN (no writes)"}`);
  console.log(`Scanned:            ${tally.scanned} rows`);
  console.log(`With attendee_email:${tally.with_email} rows`);
  console.log(`Matched:            ${tally.matched} rows`);
  console.log(`\nRejected breakdown:`);
  for (const [reason, n] of Object.entries(tally.rejected_by_reason).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${reason.padEnd(40)} ${n}`);
  }

  if (reconciled.length > 0) {
    console.log(`\nReconciled candidates (${reconciled.length}):`);
    for (const r of reconciled) {
      console.log(`  ${r.candidateName.padEnd(32)}  event=${r.eventId}  start=${r.eventStart}`);
    }
  }

  if (!COMMIT && tally.matched > 0) {
    console.log(`\nThis was a DRY-RUN — ${tally.matched} matches identified but NOT written.`);
    console.log(`Re-run with --commit to apply.`);
  }

  // Limit the verbose skip log to the first 20 entries to keep output scannable.
  if (skipped.length > 0) {
    console.log(`\nFirst 20 skipped rows (of ${skipped.length}):`);
    for (const s of skipped.slice(0, 20)) {
      console.log(`  row=${s.rowId.slice(0, 8)}… reason=${s.reason.padEnd(42)} ${s.detail}`);
    }
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
