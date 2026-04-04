import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { verifySigningToken } from "@/lib/contracts";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * GET /api/contracts/view?contractId=X&token=Y
 *
 * Returns contract HTML for viewing. Validates via token or authenticated session.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const contractId = searchParams.get("contractId");
    const token = searchParams.get("token");

    if (!contractId) {
      return NextResponse.json({ error: "Missing contractId" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Fetch contract
    const { data: contract } = await admin
      .from("engagement_contracts")
      .select("*, clients(full_name, company_name), candidates(display_name, full_name)")
      .eq("id", contractId)
      .single();

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Authorize: via token OR authenticated session
    if (token) {
      if (!verifySigningToken(contractId, token)) {
        return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
      }
    } else {
      // Must be authenticated and be the client or candidate
      const supabase = await createServerClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }

      // Check if user is client or candidate on this contract
      const { data: client } = await admin.from("clients").select("id").eq("user_id", user.id).single();
      const { data: candidate } = await admin.from("candidates").select("id").eq("user_id", user.id).single();

      const isClient = client?.id === contract.client_id;
      const isCandidate = candidate?.id === contract.candidate_id;

      if (!isClient && !isCandidate) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    const clientInfo = contract.clients as { full_name: string; company_name: string | null } | null;
    const candidateInfo = contract.candidates as { display_name: string; full_name: string } | null;

    return NextResponse.json({
      contractId: contract.id,
      contractHtml: contract.contract_html,
      status: contract.status,
      clientName: clientInfo?.company_name || clientInfo?.full_name || "Client",
      candidateName: candidateInfo?.display_name || candidateInfo?.full_name || "Contractor",
      clientSignedAt: contract.client_signed_at,
      candidateSignedAt: contract.candidate_signed_at,
      generatedAt: contract.generated_at,
      contractPdfUrl: contract.contract_pdf_url,
    });
  } catch (error) {
    console.error("Contract view error:", error);
    return NextResponse.json({ error: "Failed to load contract" }, { status: 500 });
  }
}
