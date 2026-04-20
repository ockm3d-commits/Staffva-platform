// Tests for the hardened Google Calendar match logic.
//
// Run: npx tsx --test src/lib/__tests__/google-calendar.test.ts
//
// Tests 1-7 cover the safeguards spec'd in the original prompt.
// Tests 8-9 cover the two refinements (internal-domain skip; dedup upsert).
//
// decideMatchOutcome is a pure function — no mocks needed.
// recordUnmatched is tested via a structural mock of the Supabase client so
// the on-conflict upsert shape is verified without hitting the DB.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideMatchOutcome,
  extractExternalAttendees,
  recordUnmatched,
  type CalendarEvent,
  type CandidateMatchRow,
} from "../google-calendar";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const RECRUITER_ID = "00000000-0000-0000-0000-00000000beef";
const CANDIDATE_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_CANDIDATE_ID = "22222222-2222-2222-2222-222222222222";
const EVENT_ID = "event-abc123";
const OTHER_EVENT_ID = "event-different999";

// A clean, future event with one external attendee (the candidate) and the
// recruiter as organizer. All 7 positive-path tests start from a copy of this.
function buildBaseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: EVENT_ID,
    status: "confirmed",
    summary: "Second Interview W/ Jerome (Test Candidate)",
    start: { dateTime: "2026-05-01T14:00:00Z" },
    attendees: [
      { email: "recruiter@example.com", organizer: true },
      { email: "candidate@example.com", displayName: "Test Candidate" },
    ],
    ...overrides,
  };
}

function buildCandidate(overrides: Partial<CandidateMatchRow> = {}): CandidateMatchRow {
  return {
    id: CANDIDATE_ID,
    email: "candidate@example.com",
    created_at: "2026-04-01T00:00:00Z",
    ai_interview_completed_at: "2026-04-15T00:00:00Z",
    assigned_recruiter_at: "2026-04-15T00:00:01Z",
    second_interview_status: "none",
    google_calendar_event_id: null,
    ...overrides,
  };
}

// ─── Test 1 — no external attendee email ────────────────────────────────────
test("1. rejects event with no external attendee emails as no_identifying_email", () => {
  const event = buildBaseEvent();
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: [],
    candidateMatches: [],
  });
  assert.equal(decision.kind, "unmatched");
  if (decision.kind !== "unmatched") return;
  assert.equal(decision.reason, "no_identifying_email");
});

// ─── Test 2 — email matches multiple candidates ─────────────────────────────
test("2. rejects when email resolves to multiple candidates as ambiguous_match", () => {
  const event = buildBaseEvent();
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [
      buildCandidate({ id: CANDIDATE_ID }),
      buildCandidate({ id: OTHER_CANDIDATE_ID }),
    ],
  });
  assert.equal(decision.kind, "unmatched");
  if (decision.kind !== "unmatched") return;
  assert.equal(decision.reason, "ambiguous_match");
});

// ─── Test 3 — event start predates assignment floor ─────────────────────────
test("3. rejects event that predates assigned_recruiter_at as event_before_assignment", () => {
  const event = buildBaseEvent({ start: { dateTime: "2026-04-10T14:00:00Z" } }); // before 2026-04-15
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [buildCandidate()], // assigned_recruiter_at = 2026-04-15
  });
  assert.equal(decision.kind, "unmatched");
  if (decision.kind !== "unmatched") return;
  assert.equal(decision.reason, "event_before_assignment");
});

// Safeguard-B fallback chain: covered here as an extra sanity check that the
// fallback to ai_interview_completed_at and created_at both work, with a
// console.warn when created_at is the source. We test the usedCreatedAtFloor
// flag on the MATCH branch (since the warn only fires on match).
test("3b. Safeguard B falls back to ai_interview_completed_at when assigned_recruiter_at is NULL", () => {
  const event = buildBaseEvent({ start: { dateTime: "2026-04-10T14:00:00Z" } });
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [buildCandidate({
      assigned_recruiter_at: null,
      ai_interview_completed_at: "2026-04-15T00:00:00Z",
    })],
  });
  assert.equal(decision.kind, "unmatched");
  if (decision.kind !== "unmatched") return;
  assert.equal(decision.reason, "event_before_assignment");
});

test("3c. Safeguard B final fallback to created_at sets usedCreatedAtFloor=true on match", () => {
  const event = buildBaseEvent({ start: { dateTime: "2026-05-01T14:00:00Z" } }); // after created_at
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [buildCandidate({
      assigned_recruiter_at: null,
      ai_interview_completed_at: null,
      created_at: "2026-04-01T00:00:00Z",
    })],
  });
  assert.equal(decision.kind, "match");
  if (decision.kind !== "match") return;
  assert.equal(decision.usedCreatedAtFloor, true);
});

// ─── Test 4 — existing booking collision ────────────────────────────────────
test("4. rejects when candidate already has a different google_calendar_event_id as existing_booking_collision", () => {
  const event = buildBaseEvent(); // id = EVENT_ID
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [buildCandidate({ google_calendar_event_id: OTHER_EVENT_ID })],
  });
  assert.equal(decision.kind, "unmatched");
  if (decision.kind !== "unmatched") return;
  assert.equal(decision.reason, "existing_booking_collision");
});

// ─── Test 5 — status not eligible for overwrite ─────────────────────────────
test("5. rejects when second_interview_status='completed' as status_not_eligible_for_overwrite", () => {
  const event = buildBaseEvent();
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [buildCandidate({ second_interview_status: "completed" })],
  });
  assert.equal(decision.kind, "unmatched");
  if (decision.kind !== "unmatched") return;
  assert.equal(decision.reason, "status_not_eligible_for_overwrite");
});

// ─── Test 6 — event status != confirmed ─────────────────────────────────────
test("6. rejects cancelled/tentative event as event_not_confirmed", () => {
  const event = buildBaseEvent({ status: "tentative" });
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [buildCandidate()],
  });
  assert.equal(decision.kind, "unmatched");
  if (decision.kind !== "unmatched") return;
  assert.equal(decision.reason, "event_not_confirmed");
});

// ─── Test 7 — happy path (all safeguards pass) ──────────────────────────────
test("7. valid email + future event + clean status → match", () => {
  const event = buildBaseEvent();
  const decision = decideMatchOutcome({
    event,
    eventStart: event.start!.dateTime!,
    externalEmails: ["candidate@example.com"],
    candidateMatches: [buildCandidate()],
  });
  assert.equal(decision.kind, "match");
  if (decision.kind !== "match") return;
  assert.equal(decision.candidateId, CANDIDATE_ID);
  assert.equal(decision.candidateEmail, "candidate@example.com");
  assert.equal(decision.usedCreatedAtFloor, false);
});

// ─── Test 8 — internal-domain skip (Refinement 2) ───────────────────────────
test("8. internal-only event (all attendees staffva.com or recruiter domain) returns zero external emails", () => {
  const event: CalendarEvent = {
    id: "event-team-huddle",
    status: "confirmed",
    summary: "Team Morning Huddle",
    start: { dateTime: "2026-05-01T09:00:00Z" },
    attendees: [
      { email: "jerome@example.com", organizer: true },
      { email: "ops@example.com" },          // same recruiter domain → internal
      { email: "sam@staffva.com" },          // always internal
      { email: "manar@staffva.com" },
    ],
  };
  const internalDomains = new Set<string>(["staffva.com", "example.com"]);
  const externals = extractExternalAttendees(event, internalDomains);
  assert.deepEqual(externals, []);
  // Precondition established: when this returns [], processCalendarEvent
  // short-circuits before any DB write — no calendar_unmatched_bookings row.
});

// Supplementary: verify that a single external attendee in an otherwise-
// internal event is not filtered out.
test("8b. mixed event with one candidate attendee returns that email only", () => {
  const event: CalendarEvent = {
    id: "event-second-interview",
    status: "confirmed",
    summary: "Second Interview W/ Jerome (Real Candidate)",
    start: { dateTime: "2026-05-01T14:00:00Z" },
    attendees: [
      { email: "jerome@example.com", organizer: true },
      { email: "candidate@gmail.com" }, // external
      { email: "manar@staffva.com" },   // internal
    ],
  };
  const internalDomains = new Set<string>(["staffva.com", "example.com"]);
  const externals = extractExternalAttendees(event, internalDomains);
  assert.deepEqual(externals, ["candidate@gmail.com"]);
});

// ─── Test 9 — dedup upsert on conflict (Refinement 1) ───────────────────────
test("9. recordUnmatched issues upsert with onConflict 'recruiter_id,event_id' and ignoreDuplicates", async () => {
  // Minimal structural mock — records the calls into calendar_unmatched_bookings.
  const upsertCalls: Array<{ row: Record<string, unknown>; opts: Record<string, unknown> }> = [];
  const mockSupabase = {
    from(table: string) {
      assert.equal(table, "calendar_unmatched_bookings");
      return {
        upsert(row: Record<string, unknown>, opts: Record<string, unknown>) {
          upsertCalls.push({ row, opts });
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  };

  const event: CalendarEvent = {
    id: EVENT_ID,
    status: "confirmed",
    start: { dateTime: "2026-05-01T14:00:00Z" },
    attendees: [{ email: "candidate@example.com", displayName: "Test Candidate" }],
  };

  // Call twice to simulate the webhook firing multiple times for the same event.
  await recordUnmatched(
    mockSupabase as unknown as Parameters<typeof recordUnmatched>[0],
    RECRUITER_ID,
    event,
    event.start!.dateTime!,
    "no_identifying_email",
    "candidate@example.com",
  );
  await recordUnmatched(
    mockSupabase as unknown as Parameters<typeof recordUnmatched>[0],
    RECRUITER_ID,
    event,
    event.start!.dateTime!,
    "no_identifying_email",
    "candidate@example.com",
  );

  assert.equal(upsertCalls.length, 2);
  for (const call of upsertCalls) {
    assert.equal(call.opts.onConflict, "recruiter_id,event_id");
    assert.equal(call.opts.ignoreDuplicates, true);
    assert.equal(call.row.recruiter_id, RECRUITER_ID);
    assert.equal(call.row.event_id, EVENT_ID);
    assert.equal(call.row.unmatch_reason, "no_identifying_email");
    assert.equal(call.row.attendee_email, "candidate@example.com");
    assert.equal(call.row.attendee_name, "Test Candidate");
  }
  // The DB-level unique constraint + ignoreDuplicates means both calls produce
  // at most one row in calendar_unmatched_bookings. Verified at DB layer in
  // migration 00082 (UNIQUE (recruiter_id, event_id)) and at API layer here.
});
