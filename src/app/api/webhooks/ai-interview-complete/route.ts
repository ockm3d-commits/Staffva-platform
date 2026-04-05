import { NextRequest, NextResponse } from "next/server";
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
