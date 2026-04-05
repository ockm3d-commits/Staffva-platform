import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { description } = await req.json();
    if (!description?.trim()) return NextResponse.json({ error: "Missing description" }, { status: 400 });
    if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ title: description.trim().slice(0, 80) });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 100,
        system: "You are a service title optimizer for StaffVA, a professional marketplace. Convert the following rough description into a clear, outcome-focused service title under 80 characters. The title should describe what the CLIENT gets, not what the professional does. Return the title text only.",
        messages: [{ role: "user", content: description.trim() }],
      }),
    });

    if (!response.ok) return NextResponse.json({ title: description.trim().slice(0, 80) });

    const data = await response.json();
    const title = (data?.content?.[0]?.text || description.trim()).replace(/^["']|["']$/g, "").slice(0, 80);
    return NextResponse.json({ title });
  } catch {
    return NextResponse.json({ error: "Failed to refine" }, { status: 500 });
  }
}
