import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/contracts/list
 *
 * Returns contracts for the authenticated user (client or candidate).
 */
export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const admin = getAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role === "client") {
      const { data: client } = await admin.from("clients").select("id").eq("user_id", user.id).single();
      if (!client) return NextResponse.json({ contracts: [] });

      const { data } = await admin
        .from("engagement_contracts")
        .select("id, engagement_id, status, generated_at, client_signed_at, candidate_signed_at, contract_pdf_url, candidates(display_name, role_category)")
        .eq("client_id", client.id)
        .order("generated_at", { ascending: false });

      return NextResponse.json({ contracts: data || [] });
    }

    if (profile?.role === "candidate") {
      const { data: candidate } = await admin.from("candidates").select("id").eq("user_id", user.id).single();
      if (!candidate) return NextResponse.json({ contracts: [] });

      const { data } = await admin
        .from("engagement_contracts")
        .select("id, engagement_id, status, generated_at, client_signed_at, candidate_signed_at, contract_pdf_url, clients(full_name, company_name)")
        .eq("candidate_id", candidate.id)
        .order("generated_at", { ascending: false });

      return NextResponse.json({ contracts: data || [] });
    }

    return NextResponse.json({ contracts: [] });
  } catch (error) {
    console.error("List contracts error:", error);
    return NextResponse.json({ error: "Failed to load contracts" }, { status: 500 });
  }
}
