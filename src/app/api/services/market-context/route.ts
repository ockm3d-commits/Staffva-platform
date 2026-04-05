import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * GET /api/services/market-context?category=reviewed&tier=Top Rated
 * Returns pricing percentiles and delivery time distribution
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const tier = searchParams.get("tier");

    const admin = getAdminClient();

    // Get all active packages in this category
    let query = admin
      .from("service_packages")
      .select("price_usd, delivery_days, candidate_id, candidates(reputation_tier)")
      .eq("status", "active");

    if (category) query = query.eq("outcome_category", category);

    const { data: packages } = await query;

    if (!packages || packages.length === 0) {
      return NextResponse.json({
        priceRange: null,
        deliveryDistribution: {},
        totalInCategory: 0,
      });
    }

    // Filter by tier if provided
    let filtered = packages;
    if (tier) {
      filtered = packages.filter((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const candidate = p.candidates as any;
        return candidate?.reputation_tier === tier;
      });
    }

    // Price percentiles (25th and 75th)
    const prices = filtered.map((p) => Number(p.price_usd)).filter((p) => p > 0).sort((a, b) => a - b);
    let priceRange: { low: number; high: number } | null = null;

    if (prices.length >= 2) {
      const p25Index = Math.floor(prices.length * 0.25);
      const p75Index = Math.floor(prices.length * 0.75);
      priceRange = {
        low: Math.round(prices[p25Index]),
        high: Math.round(prices[p75Index]),
      };
    } else if (prices.length === 1) {
      priceRange = { low: prices[0], high: prices[0] };
    }

    // Delivery time distribution (percentage at each option)
    const deliveryOptions = [1, 2, 3, 5, 7, 14];
    const deliveryDistribution: Record<number, number> = {};
    const total = packages.length;

    for (const days of deliveryOptions) {
      const count = packages.filter((p) => p.delivery_days === days).length;
      deliveryDistribution[days] = total > 0 ? Math.round((count / total) * 100) : 0;
    }

    return NextResponse.json({
      priceRange,
      deliveryDistribution,
      totalInCategory: total,
      totalInTier: filtered.length,
    });
  } catch (error) {
    console.error("Market context error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
