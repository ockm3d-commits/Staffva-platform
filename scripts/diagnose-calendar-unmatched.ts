// Run: npx tsx --env-file=.env.local scripts/diagnose-calendar-unmatched.ts
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mshnsbblwgcpwuxwuevp.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // Query b: full aggregate over calendar_unmatched_bookings (JS-side, paginate past 1000-row cap)
  const PAGE_SIZE = 1000;
  const allRows: { id: string; recruiter_id: string | null; event_id: string; event_start: string | null; attendee_name: string | null; created_at: string | null }[] = [];
  let page = 0;
  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: chunk, error } = await admin
      .from("calendar_unmatched_bookings")
      .select("id, recruiter_id, event_id, event_start, attendee_name, created_at")
      .range(from, to);
    if (error) { console.error("ERROR fetching unmatched bookings:", error); return; }
    if (!chunk || chunk.length === 0) break;
    allRows.push(...(chunk as typeof allRows));
    if (chunk.length < PAGE_SIZE) break;
    page++;
  }
  const rows = allRows;

  const total = rows!.length;
  const distinctRecruiters = new Set(rows!.map((r) => r.recruiter_id)).size;
  const distinctEvents = new Set(rows!.map((r) => r.event_id)).size;
  const nullAttendee = rows!.filter((r) => r.attendee_name == null).length;
  const hasEmailInAttendee = rows!.filter(
    (r) => typeof r.attendee_name === "string" && r.attendee_name.includes("@")
  ).length;
  const startsWithDates = rows!
    .filter((r) => r.event_start)
    .map((r) => r.event_start as string)
    .sort();
  const earliest = startsWithDates[0] ?? null;
  const latest = startsWithDates[startsWithDates.length - 1] ?? null;

  console.log("─── Query b: calendar_unmatched_bookings aggregate ───");
  console.log(JSON.stringify({
    total,
    distinct_recruiters: distinctRecruiters,
    distinct_events: distinctEvents,
    null_attendee: nullAttendee,
    has_email_in_attendee: hasEmailInAttendee,
    earliest,
    latest,
  }, null, 2));

  // Query c: sample 10 attendee_name values containing @
  const sample = rows!
    .filter((r) => typeof r.attendee_name === "string" && r.attendee_name.includes("@"))
    .slice(0, 10)
    .map((r) => r.attendee_name);
  console.log("\n─── Query c: sample attendee_name values containing '@' (up to 10) ───");
  console.log(JSON.stringify(sample, null, 2));

  // Extra intelligence — distribution of attendee_name null vs populated vs empty
  const emptyString = rows!.filter((r) => r.attendee_name === "").length;
  const nonEmptyNoEmail = rows!.filter(
    (r) => typeof r.attendee_name === "string" && r.attendee_name.length > 0 && !r.attendee_name.includes("@")
  ).length;
  console.log("\n─── Extra: attendee_name breakdown ───");
  console.log(JSON.stringify({
    null: nullAttendee,
    empty_string: emptyString,
    non_empty_no_email: nonEmptyNoEmail,
    non_empty_with_email: hasEmailInAttendee,
  }, null, 2));

  // Sample 10 non-email attendee names to see what the "names" actually look like
  const sampleNames = rows!
    .filter((r) => typeof r.attendee_name === "string" && r.attendee_name.length > 0 && !r.attendee_name.includes("@"))
    .slice(0, 10)
    .map((r) => r.attendee_name);
  console.log("\n─── Extra: sample non-email attendee_name values (up to 10) ───");
  console.log(JSON.stringify(sampleNames, null, 2));

  // Query d: scanned code/migrations — exec_sql in this project only returns {success}
  // not SELECT rows, so we answer via JS-side probe instead.
  console.log("\n─── Query d: probe schema by attempting to SELECT suspected columns ───");
  const probes = [
    { table: "calendar_unmatched_bookings", column: "attendee_email" },
    { table: "calendar_unmatched_bookings", column: "unmatch_reason" },
    { table: "candidates", column: "assigned_recruiter_at" },
    { table: "candidates", column: "assigned_recruiter" },
    { table: "candidates", column: "ai_interview_completed_at" },
    { table: "candidates", column: "google_calendar_event_id" },
  ];
  for (const p of probes) {
    const { error } = await admin.from(p.table).select(p.column).limit(1);
    console.log(`  ${p.table}.${p.column}: ${error ? `MISSING (${error.message})` : "EXISTS"}`);
  }

  // Linkage intelligence
  const { count: totalPending } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .eq("admin_status", "pending_2nd_interview");
  const { count: withEventId } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .eq("admin_status", "pending_2nd_interview")
    .not("google_calendar_event_id", "is", null);
  const { count: statusScheduled } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .eq("admin_status", "pending_2nd_interview")
    .eq("second_interview_status", "scheduled");
  const { count: statusCompleted } = await admin
    .from("candidates")
    .select("*", { count: "exact", head: true })
    .eq("admin_status", "pending_2nd_interview")
    .eq("second_interview_status", "completed");
  console.log("\n─── Extra: pending_2nd_interview linkage breakdown ───");
  console.log(JSON.stringify({
    total_pending: totalPending,
    with_google_event_id: withEventId,
    status_scheduled: statusScheduled,
    status_completed: statusCompleted,
  }, null, 2));

  // Unmatched: top attendee_name values by frequency (is the failure concentrated?)
  const counts = new Map<string, number>();
  for (const r of rows!) {
    const k = r.attendee_name || "<null>";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const topNames = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  console.log("\n─── Extra: top 20 attendee_name values in calendar_unmatched_bookings ───");
  console.log(JSON.stringify(topNames, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
