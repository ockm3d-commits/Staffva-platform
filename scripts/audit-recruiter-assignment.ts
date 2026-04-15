/**
 * READ-ONLY audit of recruiter->candidate assignments.
 * Run with:
 *   npx tsx scripts/audit-recruiter-assignment.ts
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
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

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function header(title: string) {
  console.log("\n" + "=".repeat(80));
  console.log(title);
  console.log("=".repeat(80));
}

async function item1() {
  header("ITEM 1 — ASSIGNMENT FIELD INTEGRITY CHECK");
  console.log(
    "QUERY: SELECT id, display_name, full_name, role_category, assigned_recruiter FROM candidates WHERE assigned_recruiter IS NOT NULL;"
  );

  // Supabase has a 1000-row hard cap; page to be safe.
  const all: Array<{
    id: string;
    display_name: string | null;
    full_name: string | null;
    role_category: string | null;
    assigned_recruiter: string | null;
  }> = [];
  let from = 0;
  const page = 1000;
  for (;;) {
    const { data, error } = await supabase
      .from("candidates")
      .select("id, display_name, full_name, role_category, assigned_recruiter")
      .not("assigned_recruiter", "is", null)
      .range(from, from + page - 1);
    if (error) {
      console.error("Item1 error:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < page) break;
    from += page;
  }

  const total = all.length;
  const uuidGroup = all.filter((r) => r.assigned_recruiter && UUID_RE.test(r.assigned_recruiter));
  const nonUuidGroup = all.filter((r) => r.assigned_recruiter && !UUID_RE.test(r.assigned_recruiter));

  console.log("\nRAW RESULTS");
  console.log(`  Total rows with assigned_recruiter IS NOT NULL: ${total}`);
  console.log(`  Valid UUID format: ${uuidGroup.length}`);
  console.log(`  NON-UUID format:   ${nonUuidGroup.length}`);

  // Distinct non-UUID values (gives us the full set of name-like strings)
  const distinctNonUuid = [...new Set(nonUuidGroup.map((r) => r.assigned_recruiter))];
  console.log(`  Distinct non-UUID values (${distinctNonUuid.length}):`, distinctNonUuid);

  console.log("\nSAMPLE of up to 10 non-UUID rows:");
  console.table(
    nonUuidGroup.slice(0, 10).map((r) => ({
      id: r.id,
      display_name: r.display_name,
      full_name: r.full_name,
      role_category: r.role_category,
      assigned_recruiter: r.assigned_recruiter,
    }))
  );

  // Save for later cross-checks
  return { all, uuidGroup, nonUuidGroup };
}

async function item2() {
  header("ITEM 2 — SPECIFIC HISTORICAL CANDIDATE 061e820a-fbb4-43d1-ae05-b60f0d6326ad");
  console.log(
    "QUERY: SELECT id, display_name, full_name, role_category, admin_status, assigned_recruiter FROM candidates WHERE id = '061e820a-fbb4-43d1-ae05-b60f0d6326ad';"
  );

  const { data, error } = await supabase
    .from("candidates")
    .select("id, display_name, full_name, role_category, admin_status, assigned_recruiter")
    .eq("id", "061e820a-fbb4-43d1-ae05-b60f0d6326ad")
    .maybeSingle();

  if (error) {
    console.error("Item2 error:", error.message);
    return null;
  }
  console.log("\nRAW RESULT:");
  console.log(JSON.stringify(data, null, 2));
  console.log(
    `\nassigned_recruiter value (raw): ${JSON.stringify(data?.assigned_recruiter)}`
  );
  console.log(
    `Is UUID format? ${data?.assigned_recruiter ? UUID_RE.test(data.assigned_recruiter) : "n/a (null)"}`
  );
  return data;
}

async function item4() {
  header("ITEM 4 — RLS POLICIES ON candidates TABLE");
  console.log(
    "QUERY: SELECT schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check FROM pg_policies WHERE tablename = 'candidates';"
  );

  // Postgres system catalogs are not directly readable via PostgREST.
  // Try an exposed RPC if one exists; otherwise report that we fell back.
  const { data: rpcData, error: rpcErr } = await supabase.rpc("debug_pg_policies", {
    target_table: "candidates",
  });

  if (!rpcErr && rpcData) {
    console.log("\nVia debug_pg_policies() RPC:");
    console.table(rpcData);
    return;
  }
  console.log(
    `\nNo 'debug_pg_policies' RPC exposed (${rpcErr?.message || "no data"}). ` +
      "Will fall back to reading migration SQL files from /supabase/migrations for policy source of truth."
  );
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  recruiter_type?: string | null;
};

async function findRecruiterByName(nameFragment: string): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, recruiter_type")
    .in("role", ["recruiter", "recruiting_manager"])
    .ilike("full_name", `%${nameFragment}%`);
  if (error) {
    console.error(`Lookup ${nameFragment} error:`, error.message);
    return [];
  }
  return data || [];
}

async function simulateDashboardQuery(recruiterId: string) {
  // Mirror exactly the logic in src/app/api/recruiter/dashboard/route.ts Step 1 "assignedCandidates"
  // and the "Queue" query (what lands in "New Candidates").
  const { data: assignedCandidates, error: assignedErr } = await supabase
    .from("candidates")
    .select("id, display_name, full_name, role_category")
    .eq("assigned_recruiter", recruiterId);

  const { data: queue, error: queueErr } = await supabase
    .from("candidates")
    .select("id, display_name, full_name, role_category, ai_interview_completed_at")
    .eq("assigned_recruiter", recruiterId)
    .not("ai_interview_completed_at", "is", null)
    .eq("second_interview_status", "none")
    .order("ai_interview_completed_at", { ascending: true });

  return {
    assignedCandidates: assignedCandidates || [],
    assignedErr,
    queue: queue || [],
    queueErr,
  };
}

async function item5(
  auditData: { all: Array<{ id: string; display_name: string | null; full_name: string | null; role_category: string | null; assigned_recruiter: string | null }> }
) {
  header("ITEM 5 — CROSS-CHECK SCREENSHOT FINDINGS (5 RECRUITERS)");

  const targets: Array<{ label: string; profileId?: string; lookupName?: string }> = [
    { label: "Manar (Recruiting Manager)", profileId: "73da7f50-b637-4b8d-a38e-7ae36e2acfd5" },
    { label: "Jerome", lookupName: "Jerome" },
    { label: "Leyan", lookupName: "Leyan" },
    { label: "Ranim", lookupName: "Ranim" },
    { label: "Shelly", lookupName: "Shelly" },
  ];

  for (const t of targets) {
    console.log("\n" + "-".repeat(60));
    console.log(`• ${t.label}`);

    let profile: ProfileRow | null = null;
    if (t.profileId) {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role, recruiter_type")
        .eq("id", t.profileId)
        .maybeSingle();
      if (error) console.error("  profile lookup error:", error.message);
      profile = data || null;
    } else if (t.lookupName) {
      const matches = await findRecruiterByName(t.lookupName);
      if (matches.length === 0) {
        console.log(`  (no recruiter/manager profile found matching '${t.lookupName}')`);
        continue;
      }
      if (matches.length > 1) {
        console.log(`  Multiple profile matches for '${t.lookupName}':`);
        console.table(matches);
        profile = matches[0]; // use first, but flag it
        console.log(`  → using first match: ${profile.id} / ${profile.full_name}`);
      } else {
        profile = matches[0];
      }
    }

    if (!profile) {
      console.log("  profile: NOT FOUND");
      continue;
    }
    console.log(
      `  profile: id=${profile.id}  name=${profile.full_name}  email=${profile.email}  role=${profile.role}  recruiter_type=${profile.recruiter_type ?? "—"}`
    );

    const sim = await simulateDashboardQuery(profile.id);
    if (sim.assignedErr) console.error("  assignedErr:", sim.assignedErr.message);
    if (sim.queueErr) console.error("  queueErr:", sim.queueErr.message);

    console.log(
      `  candidates matched by .eq("assigned_recruiter", "${profile.id}"): ${sim.assignedCandidates.length}`
    );
    console.log(
      `  candidates matched for "New Candidates" queue (ai_interview_completed_at NOT NULL AND second_interview_status='none'): ${sim.queue.length}`
    );
    console.log("  first 5 assigned:");
    console.table(
      sim.assignedCandidates.slice(0, 5).map((c) => ({
        id: c.id,
        display_name: c.display_name,
        full_name: c.full_name,
        role_category: c.role_category,
      }))
    );
    console.log("  first 5 queue:");
    console.table(
      sim.queue.slice(0, 5).map((c) => ({
        id: c.id,
        display_name: c.display_name,
        full_name: c.full_name,
        role_category: c.role_category,
        ai_interview_completed_at: c.ai_interview_completed_at,
      }))
    );

    // Extra diagnostic: also search by first-name STRING in assigned_recruiter,
    // to see if any rows point at a name-like string matching this recruiter.
    const firstName = (profile.full_name || "").split(/\s+/)[0];
    if (firstName) {
      const byNameMatches = auditData.all.filter(
        (r) => (r.assigned_recruiter || "").toLowerCase() === firstName.toLowerCase()
      );
      console.log(
        `  extra: candidates whose assigned_recruiter STRING equals '${firstName}' (case-insensitive): ${byNameMatches.length}`
      );
      if (byNameMatches.length > 0) {
        console.table(
          byNameMatches.slice(0, 10).map((r) => ({
            id: r.id,
            display_name: r.display_name,
            full_name: r.full_name,
            role_category: r.role_category,
            assigned_recruiter: r.assigned_recruiter,
          }))
        );
      }
    }
  }
}

async function main() {
  const { all } = await item1();
  await item2();
  await item4();
  await item5({ all });

  console.log("\n" + "=".repeat(80));
  console.log("AUDIT COMPLETE — no writes performed.");
  console.log("=".repeat(80));
}

main().catch((e) => {
  console.error("Audit failed:", e);
  process.exit(1);
});
