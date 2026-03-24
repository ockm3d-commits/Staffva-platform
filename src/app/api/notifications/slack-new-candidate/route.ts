import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ skipped: true, reason: "No SLACK_WEBHOOK_URL configured" });
    }

    const { candidate_id } = await req.json();
    if (!candidate_id) {
      return NextResponse.json({ error: "Missing candidate_id" }, { status: 400 });
    }

    const supabase = getAdminClient();

    const { data: candidate } = await supabase
      .from("candidates")
      .select("id, display_name, role_category, country, screening_tag, screening_score")
      .eq("id", candidate_id)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Determine emoji for screening tag
    const tagEmoji: Record<string, string> = {
      Priority: "🟢",
      Review: "🟡",
      Hold: "🔘",
    };
    const emoji = tagEmoji[candidate.screening_tag || "Review"] || "🟡";
    const tag = candidate.screening_tag || "Review";
    const score = candidate.screening_score || "N/A";

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://staffva.com";

    const slackMessage = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "📋 New Candidate Application",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Name:*\n${candidate.display_name}`,
            },
            {
              type: "mrkdwn",
              text: `*Role:*\n${candidate.role_category}`,
            },
            {
              type: "mrkdwn",
              text: `*Country:*\n${candidate.country}`,
            },
            {
              type: "mrkdwn",
              text: `*AI Screening:*\n${emoji} ${tag} (${score}/10)`,
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: {
                type: "plain_text",
                text: "Review in Admin Panel",
                emoji: true,
              },
              url: `${siteUrl}/admin/candidates`,
              style: "primary",
            },
          ],
        },
      ],
    };

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackMessage),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Slack notification error:", err);
    // Never fail — just return success
    return NextResponse.json({ success: true, error: "Notification failed silently" });
  }
}
