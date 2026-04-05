import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * GET /api/services/browse
 * Returns active service packages with candidate details for the browse page.
 * Query params: category, delivery, minPrice, maxPrice, tier
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const delivery = searchParams.get("delivery");
    const tier = searchParams.get("tier");

    const admin = getAdminClient();

    let query = admin
      .from("service_packages")
      .select("*, candidates(id, display_name, country, role_category, profile_photo_url, english_written_tier, speaking_level, reputation_tier, reputation_score, hourly_rate, voice_recording_1_preview_url, total_earnings_usd)")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("outcome_category", category);
    }

    if (delivery) {
      query = query.lte("delivery_days", parseInt(delivery));
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let services = data || [];

    // Filter by reputation tier if specified
    if (tier) {
      services = services.filter((s) => {
        const candidate = s.candidates as Record<string, unknown> | null;
        return candidate?.reputation_tier === tier;
      });
    }

    // Get featured (Elite/Top Rated professionals)
    const featured = services.filter((s) => {
      const candidate = s.candidates as Record<string, unknown> | null;
      return candidate?.reputation_tier === "Elite" || candidate?.reputation_tier === "Top Rated";
    }).slice(0, 4);

    // Group by outcome category
    const categories = ["reviewed", "written", "designed", "organized", "built", "managed"];
    const byCategory: Record<string, typeof services> = {};
    for (const cat of categories) {
      byCategory[cat] = services.filter((s) => s.outcome_category === cat).slice(0, 3);
    }

    // Get review counts per candidate
    const candidateIds = [...new Set(services.map((s) => (s.candidates as Record<string, unknown>)?.id as string).filter(Boolean))];
    let reviewCounts: Record<string, { count: number; avg: number }> = {};

    if (candidateIds.length > 0) {
      const { data: reviews } = await admin
        .from("reviews")
        .select("candidate_id, rating")
        .in("candidate_id", candidateIds)
        .eq("published", true);

      for (const r of reviews || []) {
        if (!reviewCounts[r.candidate_id]) {
          reviewCounts[r.candidate_id] = { count: 0, avg: 0 };
        }
        reviewCounts[r.candidate_id].count++;
        reviewCounts[r.candidate_id].avg += r.rating;
      }
      for (const id in reviewCounts) {
        reviewCounts[id].avg = Math.round((reviewCounts[id].avg / reviewCounts[id].count) * 10) / 10;
      }
    }

    return NextResponse.json({
      services,
      featured,
      byCategory,
      reviewCounts,
      total: services.length,
    });
  } catch (error) {
    console.error("Services browse error:", error);
    return NextResponse.json({ error: "Failed to load services" }, { status: 500 });
  }
}
