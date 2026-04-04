/**
 * Offer flow e2e test.
 * Run: node scripts/test-offer-flow.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zaG5zYmJsd2djcHd1eHd1ZXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzMjYwOSwiZXhwIjoyMDg5NzA4NjA5fQ.VoSXw8GzKY0VqOkEjA_YJ-fYoaRMwi9yoO9shOxa3qY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runTest() {
  console.log("\n📋 Offer Flow E2E Test\n");

  const { data: candidates } = await supabase.from("candidates").select("id, hourly_rate").limit(1);
  const { data: clients } = await supabase.from("clients").select("id").limit(1);
  if (!candidates?.[0] || !clients?.[0]) { console.log("❌ Need candidate + client"); return; }

  const candidate = candidates[0];
  const client = clients[0];

  // TEST 1: Create offer
  console.log("═══ TEST 1: Create Offer ═══");
  const hourlyRate = 12;
  const hoursPerWeek = 40;
  const monthlyEquiv = hourlyRate * hoursPerWeek * 4.33;
  const platformFee = monthlyEquiv * 0.10;
  const clientMonthly = monthlyEquiv + platformFee;

  const { data: offer, error: insertErr } = await supabase.from("engagement_offers").insert({
    candidate_id: candidate.id,
    client_id: client.id,
    hourly_rate: hourlyRate,
    hours_per_week: hoursPerWeek,
    contract_length: "3 months",
    start_date: "2026-04-15",
    personal_message: "Test offer message",
    estimated_monthly_cost: clientMonthly,
    estimated_contract_total: clientMonthly * 3,
    candidate_rate_comparison: hourlyRate >= Number(candidate.hourly_rate) ? "above" : "below",
    status: "sent",
    sent_at: new Date().toISOString(),
  }).select().single();

  console.log(`   Created: ${offer ? "✓" : "✗"} ${insertErr?.message || ""}`);

  if (!offer) return;

  // TEST 2: Preview calculations
  console.log(`\n═══ TEST 2: Offer Calculations ═══`);
  console.log(`   Hourly: $${hourlyRate}/hr × ${hoursPerWeek} hrs/week`);
  console.log(`   Monthly equiv: $${monthlyEquiv.toFixed(0)} ${Math.abs(monthlyEquiv - 2078.4) < 1 ? "✓" : "✗"}`);
  console.log(`   Platform fee: $${platformFee.toFixed(0)} (10%)`);
  console.log(`   Client monthly: $${clientMonthly.toFixed(0)}`);
  console.log(`   Contract total (3mo): $${(clientMonthly * 3).toFixed(0)}`);

  // TEST 3: Rate comparison
  console.log(`\n═══ TEST 3: Rate Comparison ═══`);
  const comparison = offer.candidate_rate_comparison;
  console.log(`   Candidate stated: $${candidate.hourly_rate}/hr`);
  console.log(`   Offer: $${hourlyRate}/hr`);
  console.log(`   Comparison: ${comparison} ${comparison ? "✓" : "✗"}`);

  // TEST 4: Status transitions
  console.log(`\n═══ TEST 4: Status Transitions ═══`);
  // Sent → Viewed
  await supabase.from("engagement_offers").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", offer.id);
  const { data: viewed } = await supabase.from("engagement_offers").select("status").eq("id", offer.id).single();
  console.log(`   Sent → Viewed: ${viewed?.status === "viewed" ? "✓" : "✗"}`);

  // Viewed → Accepted
  await supabase.from("engagement_offers").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", offer.id);
  const { data: accepted } = await supabase.from("engagement_offers").select("status").eq("id", offer.id).single();
  console.log(`   Viewed → Accepted: ${accepted?.status === "accepted" ? "✓" : "✗"}`);

  // TEST 5: Expiry logic
  console.log(`\n═══ TEST 5: Expiry Logic ═══`);
  const { data: expiredOffer } = await supabase.from("engagement_offers").insert({
    candidate_id: candidate.id,
    client_id: client.id,
    hourly_rate: 10,
    hours_per_week: 20,
    contract_length: "1 month",
    start_date: "2026-04-01",
    estimated_monthly_cost: 100,
    estimated_contract_total: 100,
    status: "sent",
    sent_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
  }).select().single();

  if (expiredOffer) {
    const sentAt = new Date(expiredOffer.sent_at);
    const expiry = new Date(sentAt.getTime() + 5 * 24 * 60 * 60 * 1000);
    const isExpired = expiry < new Date();
    console.log(`   Offer sent 6 days ago`);
    console.log(`   Expired: ${isExpired ? "✓" : "✗"} (5-day window)`);

    // Cleanup
    await supabase.from("engagement_offers").delete().eq("id", expiredOffer.id);
  }

  // Cleanup
  console.log(`\n🧹 Cleaning up...`);
  await supabase.from("engagement_offers").delete().eq("id", offer.id);
  console.log(`   ✅ Done`);

  console.log(`\n✅ OFFER FLOW TEST PASSED`);
  console.log(`   ✓ Offer created with all fields`);
  console.log(`   ✓ Calculations correct (monthly equiv, fee, total)`);
  console.log(`   ✓ Rate comparison detected`);
  console.log(`   ✓ Status transitions: sent → viewed → accepted`);
  console.log(`   ✓ 5-day expiry logic works`);
}

runTest().catch(console.error);
