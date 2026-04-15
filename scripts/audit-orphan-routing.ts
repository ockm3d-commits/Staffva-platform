/**
 * STEP B — READ-ONLY pre-cleanup audit.
 *
 * For each of the ~24 orphan candidates (assigned_recruiter = "Jerome" or "Shelly"),
 * resolve where they would be re-routed under the role_category -> recruiter_assignments
 * lookup used by the Step A fix. Emits a READY / BLOCKED signal.
 *
 * Run:
 *   npx tsx scripts/audit-orphan-routing.ts
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * NO WRITES. SELECT QUERIES ONLY.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mshnsbblwgcpwuxwuevp.supabase.co";
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, KEY);

const MANAR_RECRUITING_MANAGER_ID = "73da7f50-b637-4b8d-a38e-7ae36e2acfd5";
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function hr(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

async function main() {
  // ── Sanity check: is recruiter_assignments populated at all? ─────────────
  hr("SANITY CHECK — recruiter_assignments table");
  const { data: assignmentRows, error: assignmentErr } = await supabase
    .from("recruiter_assignments")
    .select("role_category, recruiter_id");
  if (assignmentErr) {
    console.error("Failed to read recruiter_assignments:", assignmentErr.message);
    console.log("\n🚨 STEP C BLOCKED — cannot read recruiter_assignments.");
    process.exit(2);
  }
  const assignmentMap = new Map<string, string>();
  for (const r of assignmentRows || []) {
    assignmentMap.set(r.role_category, r.recruiter_id);
  }
  console.log(`recruiter_assignments rows: ${assignmentRows?.length ?? 0}`);
  console.log(`distinct role_categories routed: ${assignmentMap.size}`);
  if ((assignmentRows?.length ?? 0) === 0) {
    console.log("\n🚨 STEP C BLOCKED — recruiter_assignments is empty.");
    process.exit(2);
  }

  // Print the whole routing table so the reviewer can eyeball it
  const sortedRows = [...(assignmentRows || [])].sort((a, b) =>
    a.role_category.localeCompare(b.role_category)
  );
  console.table(sortedRows);

  // Pre-load recruiter profile names for pretty output
  const recruiterIds = [...new Set((assignmentRows || []).map((r) => r.recruiter_id))];
  recruiterIds.push(MANAR_RECRUITING_MANAGER_ID);
  const { data: recruiterProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .in("id", recruiterIds);
  const profileById = new Map<string, { full_name: string | null; role: string | null }>();
  for (const p of recruiterProfiles || []) {
    profileById.set(p.id, { full_name: p.full_name, role: p.role });
  }

  // ── Pull the orphan candidates (assigned_recruiter not a UUID) ───────────
  hr("ORPHAN CANDIDATES (assigned_recruiter is a name string)");
  const all: Array<{
    id: string;
    display_name: string | null;
    full_name: string | null;
    role_category: string | null;
    admin_status: string | null;
    assigned_recruiter: string | null;
  }> = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, display_name, full_name, role_category, admin_status, assigned_recruiter")
      .not("assigned_recruiter", "is", null)
      .range(from, from + page - 1);
    if (error) {
      console.error("Failed to read candidates:", error.message);
      process.exit(2);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }
  const orphans = all.filter(
    (r) => r.assigned_recruiter && !UUID_RE.test(r.assigned_recruiter)
  );
  console.log(`orphans found: ${orphans.length}`);

  // ── Resolve each orphan's destination ────────────────────────────────────
  type Row = {
    id: string;
    display_name: string | null;
    role_category: string | null;
    admin_status: string | null;
    current_assigned_recruiter: string | null;
    resolved_recruiter_id: string;
    resolved_recruiter_name: string;
    destination: "ROUTED" | "MANAR_FALLBACK_NO_ROUTING_ROW" | "MANAR_FALLBACK_OTHER" | "MANAR_FALLBACK_NULL_ROLE";
    pending_review: boolean;
  };

  const rows: Row[] = [];
  let routed = 0;
  let fallbackNoRow = 0;
  let fallbackOther = 0;
  let fallbackNullRole = 0;
  let routedToManarDirectly = 0; // role_category has a routing row whose recruiter_id happens to be Manar
  const missingRoleCategories = new Set<string>();
  const orphanRoleCategoryCounts = new Map<string, number>();

  for (const c of orphans) {
    const rc = c.role_category ?? null;
    if (rc) orphanRoleCategoryCounts.set(rc, (orphanRoleCategoryCounts.get(rc) ?? 0) + 1);

    let resolvedId: string;
    let destination: Row["destination"];
    let pendingReview: boolean;

    if (!rc) {
      resolvedId = MANAR_RECRUITING_MANAGER_ID;
      destination = "MANAR_FALLBACK_NULL_ROLE";
      pendingReview = true;
      fallbackNullRole++;
    } else if (rc === "Other") {
      resolvedId = MANAR_RECRUITING_MANAGER_ID;
      destination = "MANAR_FALLBACK_OTHER";
      pendingReview = true;
      fallbackOther++;
    } else {
      const matched = assignmentMap.get(rc);
      if (matched) {
        resolvedId = matched;
        destination = "ROUTED";
        pendingReview = false;
        routed++;
        if (matched === MANAR_RECRUITING_MANAGER_ID) routedToManarDirectly++;
      } else {
        resolvedId = MANAR_RECRUITING_MANAGER_ID;
        destination = "MANAR_FALLBACK_NO_ROUTING_ROW";
        pendingReview = true;
        fallbackNoRow++;
        missingRoleCategories.add(rc);
      }
    }

    rows.push({
      id: c.id,
      display_name: c.display_name,
      role_category: rc,
      admin_status: c.admin_status,
      current_assigned_recruiter: c.assigned_recruiter,
      resolved_recruiter_id: resolvedId,
      resolved_recruiter_name: profileById.get(resolvedId)?.full_name ?? "(unknown)",
      destination,
      pending_review: pendingReview,
    });
  }

  // ── Print the per-candidate table ────────────────────────────────────────
  hr("PER-CANDIDATE RESOLUTION TABLE");
  console.table(
    rows.map((r) => ({
      id: r.id,
      display_name: r.display_name,
      role_category: r.role_category,
      admin_status: r.admin_status,
      current: r.current_assigned_recruiter,
      resolved_to: r.resolved_recruiter_name,
      destination: r.destination,
      pending: r.pending_review,
    }))
  );

  // ── Aggregates ───────────────────────────────────────────────────────────
  hr("AGGREGATE SUMMARY");
  console.log(`Total orphans:                                        ${orphans.length}`);
  console.log(`Routed cleanly via recruiter_assignments:             ${routed}`);
  console.log(`   ... of which route to Manar's UUID directly:       ${routedToManarDirectly}`);
  console.log(`Fallback to Manar (role_category === "Other"):        ${fallbackOther}`);
  console.log(`Fallback to Manar (NULL role_category):               ${fallbackNullRole}`);
  console.log(`Fallback to Manar (NO ROUTING ROW for role_category): ${fallbackNoRow}`);
  const totalFallback = fallbackOther + fallbackNullRole + fallbackNoRow;
  console.log(`Total landing on Manar (with pending_review = true):  ${totalFallback}`);

  hr("DISTINCT role_category AMONG THE 24 ORPHANS");
  console.table(
    [...orphanRoleCategoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([role_category, count]) => ({ role_category, count }))
  );

  hr("ORPHAN role_categoryS WITH NO ROUTING ROW");
  if (missingRoleCategories.size === 0) {
    console.log("(none — every orphan role_category has a routing row, or is 'Other'/null)");
  } else {
    console.table([...missingRoleCategories].map((rc) => ({ role_category: rc })));
  }

  // ── READY / BLOCKED verdict ──────────────────────────────────────────────
  hr("VERDICT");
  // Definition of READY: every orphan resolves to either (a) a valid recruiter UUID
  // via recruiter_assignments, or (b) the known Manar fallback UUID with
  // pending_review=true. Because the fallback is always structurally valid, the
  // only structural blocker would be an empty recruiter_assignments table, which
  // is already checked above.
  //
  // Extra safety: ensure the resolved recruiter UUIDs all correspond to rows in
  // profiles (i.e., recruiter_assignments doesn't point at a deleted profile).
  const unresolvedProfileIds = [...new Set(rows.map((r) => r.resolved_recruiter_id))].filter(
    (id) => !profileById.has(id)
  );
  if (unresolvedProfileIds.length > 0) {
    console.log("🚨 STEP C BLOCKED — some resolved recruiter UUIDs do not exist in profiles:");
    console.table(unresolvedProfileIds.map((id) => ({ id })));
    process.exit(2);
  }
  console.log("✅ READY FOR STEP C");
  console.log(
    `All ${orphans.length} orphans have a clean destination: ${routed} routed via recruiter_assignments, ${totalFallback} fallback to Manar (pending_review = true).`
  );
  console.log(
    `recruiter_assignments covers ${assignmentMap.size} role_categories across ${recruiterIds.length - 1} distinct recruiters, plus Manar as the fallback sink.`
  );
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
