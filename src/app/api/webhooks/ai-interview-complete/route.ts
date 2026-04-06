import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateInsights } from "@/lib/generateInsights";

/**
 * POST /api/webhooks/ai-interview-complete
 * Trigger AI insights regeneration when an AI interview is completed.
 * Body: { candidateId: string }
 * Protected by CRON_SECRET bearer token.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { candidateId } = await req.json();
    if (!candidateId) {
      return NextResponse.json({ error: "Missing candidateId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if this candidate passed the AI interview
    const { data: aiInterview } = await supabase
      .from("ai_interviews")
      .select("passed")
      .eq("candidate_id", candidateId)
      .eq("status", "completed")
      .eq("passed", true)
      .limit(1)
      .maybeSingle();

    if (aiInterview) {
      // Auto-approve — skip manual admin review
      await supabase
        .from("candidates")
        .update({
          admin_status: "approved",
          profile_went_live_at: new Date().toISOString(),
        })
        .eq("id", candidateId)
        .neq("admin_status", "approved");

      console.log("[AI Interview Webhook] Auto-approved candidate:", candidateId);
    }

    // Auto-assign recruiter based on role_category
    const { data: candidate } = await supabase
      .from("candidates")
      .select("role_category")
      .eq("id", candidateId)
      .single();

    if (candidate?.role_category) {
      const { data: assignment } = await supabase
        .from("recruiter_assignments")
        .select("recruiter_id")
        .eq("role_category", candidate.role_category)
        .limit(1)
        .maybeSingle();

      if (assignment?.recruiter_id) {
        await supabase
          .from("candidates")
          .update({ assigned_recruiter: assignment.recruiter_id })
          .eq("id", candidateId);

        console.log("[AI Interview Webhook] Assigned recruiter:", assignment.recruiter_id, "to candidate:", candidateId);
      }
    }

    // Fire and forget — don't block the response
    generateInsights(candidateId).catch((err) =>
      console.error("[AI Insights Webhook] Error:", err)
    );

    return NextResponse.json({ success: true, message: "Insights generation triggered" });
  } catch (error) {
    console.error("[AI Insights Webhook] Error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}
