/**
 * Load test for screening queue system.
 * Inserts 200 test screening jobs and verifies queue integrity.
 * Does NOT actually call Claude API — tests queue insert + status tracking only.
 * Run: node scripts/load-test-screening-queue.mjs
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zaG5zYmJsd2djcHd1eHd1ZXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzMjYwOSwiZXhwIjoyMDg5NzA4NjA5fQ.VoSXw8GzKY0VqOkEjA_YJ-fYoaRMwi9yoO9shOxa3qY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const TEST_COUNT = 200;

async function runTest() {
  console.log(`\n🤖 Screening Queue Load Test: ${TEST_COUNT} concurrent jobs\n`);

  // First get some real candidate IDs to reference
  const { data: candidates } = await supabase
    .from("candidates")
    .select("id")
    .limit(20);

  if (!candidates || candidates.length === 0) {
    console.log("❌ No candidates found. Need at least 1 candidate in the database.");
    return;
  }

  console.log(`📋 Found ${candidates.length} candidates to distribute jobs across\n`);

  const startTime = Date.now();

  // Insert 200 screening queue items
  const insertPromises = Array.from({ length: TEST_COUNT }, (_, i) => {
    const candidateId = candidates[i % candidates.length].id;
    return supabase
      .from("screening_queue")
      .insert({
        candidate_id: candidateId,
        status: "pending",
      })
      .select("id")
      .single()
      .then(({ data, error }) => ({ data, error, index: i }));
  });

  const results = await Promise.all(insertPromises);

  const insertTime = Date.now() - startTime;
  const successful = results.filter((r) => r.data && !r.error);
  const failed = results.filter((r) => r.error);

  console.log(`📊 Insert Results:`);
  console.log(`   Total: ${TEST_COUNT}`);
  console.log(`   Successful: ${successful.length}`);
  console.log(`   Failed: ${failed.length}`);
  console.log(`   Time: ${insertTime}ms (${(insertTime / TEST_COUNT).toFixed(1)}ms per insert)`);

  if (failed.length > 0) {
    console.log(`\n❌ Insert Failures:`);
    failed.slice(0, 5).forEach((f) => console.log(`   Job ${f.index}: ${f.error?.message}`));
  }

  // Verify queue status distribution
  const { data: queueItems } = await supabase
    .from("screening_queue")
    .select("id, status")
    .in("id", successful.map((s) => s.data.id));

  const statusCounts = { pending: 0, processing: 0, complete: 0, failed: 0, rate_limited: 0 };
  for (const item of (queueItems || [])) {
    statusCounts[item.status]++;
  }

  console.log(`\n📋 Queue Status After Insert:`);
  console.log(`   Pending: ${statusCounts.pending}`);
  console.log(`   Processing: ${statusCounts.processing}`);
  console.log(`   Complete: ${statusCounts.complete}`);
  console.log(`   Failed: ${statusCounts.failed}`);
  console.log(`   Rate Limited: ${statusCounts.rate_limited}`);

  // Simulate rate limit handling by updating some to rate_limited
  const testIds = successful.slice(0, 10).map((s) => s.data.id);
  const rateLimitTime = new Date(Date.now() + 120000).toISOString(); // 2 min from now

  await supabase
    .from("screening_queue")
    .update({
      status: "rate_limited",
      next_retry_at: rateLimitTime,
      retry_count: 1,
      error_text: "Simulated rate limit",
    })
    .in("id", testIds);

  // Verify rate limited items
  const { count: rateLimited } = await supabase
    .from("screening_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "rate_limited")
    .in("id", testIds);

  console.log(`\n🔄 Rate Limit Simulation:`);
  console.log(`   Set ${testIds.length} items to rate_limited`);
  console.log(`   Verified: ${rateLimited} items in rate_limited status`);
  console.log(`   Next retry at: ${rateLimitTime}`);

  // Simulate failed items exceeding retry limit
  const failTestIds = successful.slice(10, 15).map((s) => s.data.id);
  await supabase
    .from("screening_queue")
    .update({
      status: "failed",
      retry_count: 5,
      error_text: "Simulated permanent failure after 5 retries",
    })
    .in("id", failTestIds);

  const { count: permanentFailed } = await supabase
    .from("screening_queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "failed")
    .gte("retry_count", 5)
    .in("id", failTestIds);

  console.log(`\n💀 Permanent Failure Simulation:`);
  console.log(`   Set ${failTestIds.length} items to permanently failed (5 retries)`);
  console.log(`   Verified: ${permanentFailed} items flagged for admin alert`);

  // Clean up all test data
  console.log(`\n🧹 Cleaning up ${successful.length} test items...`);
  const allTestIds = successful.map((s) => s.data.id);

  // Delete in batches of 50
  for (let i = 0; i < allTestIds.length; i += 50) {
    const batch = allTestIds.slice(i, i + 50);
    await supabase
      .from("screening_queue")
      .delete()
      .in("id", batch);
  }
  console.log(`   ✅ Test data cleaned up`);

  const totalTime = Date.now() - startTime;
  console.log(`\n⏱  Total test time: ${totalTime}ms`);

  // Verdict
  const allPassed =
    successful.length === TEST_COUNT &&
    rateLimited === testIds.length &&
    permanentFailed === failTestIds.length;

  if (allPassed) {
    console.log(`\n✅ SCREENING QUEUE LOAD TEST PASSED`);
    console.log(`   ✓ ${TEST_COUNT}/${TEST_COUNT} queue inserts successful`);
    console.log(`   ✓ Rate limit simulation verified`);
    console.log(`   ✓ Permanent failure detection verified`);
    console.log(`   ✓ Average insert: ${(insertTime / TEST_COUNT).toFixed(1)}ms`);
    console.log(`   ✓ Throughput: ${Math.floor(1000 / (insertTime / TEST_COUNT))} inserts/second`);
  } else {
    console.log(`\n❌ SCREENING QUEUE LOAD TEST FAILED`);
    if (successful.length !== TEST_COUNT) console.log(`   ✗ Only ${successful.length}/${TEST_COUNT} inserts succeeded`);
    if (rateLimited !== testIds.length) console.log(`   ✗ Rate limit: expected ${testIds.length}, got ${rateLimited}`);
    if (permanentFailed !== failTestIds.length) console.log(`   ✗ Permanent fail: expected ${failTestIds.length}, got ${permanentFailed}`);
  }
}

runTest().catch(console.error);
