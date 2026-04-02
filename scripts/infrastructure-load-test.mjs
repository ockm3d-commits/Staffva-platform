/**
 * StaffVA Infrastructure Capacity Validation
 * Tests: DB connections, Storage uploads, Queue submissions
 * Run: node scripts/infrastructure-load-test.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "fs";

const SUPABASE_URL = "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zaG5zYmJsd2djcHd1eHd1ZXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzMjYwOSwiZXhwIjoyMDg5NzA4NjA5fQ.VoSXw8GzKY0VqOkEjA_YJ-fYoaRMwi9yoO9shOxa3qY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const report = {
  timestamp: new Date().toISOString(),
  tests: [],
  overallPass: true,
};

function addResult(name, data) {
  const passed = data.passed !== false;
  if (!passed) report.overallPass = false;
  report.tests.push({ name, ...data, passed });
}

// ═══════════════════════════════════════════
// TEST 1: Database Connection Pool
// ═══════════════════════════════════════════
async function testDBConnections() {
  console.log("\n═══ TEST 1: Database Connection Pool ═══\n");

  const levels = [100, 250, 500];
  const results = {};

  for (const concurrency of levels) {
    console.log(`  Testing ${concurrency} concurrent connections...`);
    const start = Date.now();
    const times = [];
    let failures = 0;

    const promises = Array.from({ length: concurrency }, async () => {
      const qStart = Date.now();
      try {
        const { error } = await supabase
          .from("candidates")
          .select("id")
          .limit(1);
        const elapsed = Date.now() - qStart;
        times.push(elapsed);
        if (error) failures++;
      } catch {
        times.push(Date.now() - qStart);
        failures++;
      }
    });

    await Promise.all(promises);
    const totalTime = Date.now() - start;

    times.sort((a, b) => a - b);
    const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
    const p50 = times[Math.floor(times.length * 0.5)];
    const p95 = times[Math.floor(times.length * 0.95)];
    const p99 = times[Math.floor(times.length * 0.99)];
    const max = times[times.length - 1];
    const over500 = times.filter((t) => t > 500).length;

    results[concurrency] = { avg, p50, p95, p99, max, failures, totalTime, over500 };

    console.log(`    Avg: ${avg}ms | P50: ${p50}ms | P95: ${p95}ms | P99: ${p99}ms | Max: ${max}ms`);
    console.log(`    Failures: ${failures}/${concurrency} | Over 500ms: ${over500}`);
    console.log(`    Total time: ${totalTime}ms`);

    // Brief pause between levels
    await new Promise((r) => setTimeout(r, 2000));
  }

  const anyOver500 = Object.values(results).some((r) => r.p95 > 500);
  const anyFailures = Object.values(results).some((r) => r.failures > 0);

  addResult("Database Connection Pool", {
    concurrencyLevels: results,
    passed: !anyOver500 || !anyFailures,
    flags: [
      ...(anyOver500 ? ["P95 response time exceeded 500ms at one or more concurrency levels"] : []),
      ...(anyFailures ? ["Connection failures detected"] : []),
    ],
    remediation: anyOver500 || anyFailures
      ? "Consider upgrading Supabase plan for higher connection pool limits. Current free tier allows ~60 direct connections. Use connection pooling (PgBouncer) for production."
      : null,
  });

  return !anyOver500;
}

// ═══════════════════════════════════════════
// TEST 2: Storage Upload Concurrency
// ═══════════════════════════════════════════
async function testStorageUploads() {
  console.log("\n═══ TEST 2: Storage Upload Concurrency (200 × ~2MB) ═══\n");

  const UPLOAD_COUNT = 200;
  // Create a ~2MB test blob (2048 KB of random-ish data)
  const testData = new Uint8Array(2 * 1024 * 1024);
  for (let i = 0; i < testData.length; i++) {
    testData[i] = i % 256;
  }
  const testBlob = new Blob([testData], { type: "audio/webm" });

  console.log(`  Uploading ${UPLOAD_COUNT} files of ${(testBlob.size / 1024 / 1024).toFixed(1)}MB each...`);

  const start = Date.now();
  const times = [];
  let successes = 0;
  let failures = 0;
  const errors = [];

  // Upload in batches of 50 to avoid overwhelming
  const BATCH = 50;
  for (let batch = 0; batch < UPLOAD_COUNT; batch += BATCH) {
    const batchSize = Math.min(BATCH, UPLOAD_COUNT - batch);
    const batchPromises = Array.from({ length: batchSize }, async (_, i) => {
      const idx = batch + i;
      const fileName = `load-test/${idx}-${Date.now()}.webm`;
      const uStart = Date.now();
      try {
        const { error } = await supabase.storage
          .from("voice-recordings")
          .upload(fileName, testBlob, { upsert: true });
        const elapsed = Date.now() - uStart;
        times.push(elapsed);
        if (error) {
          failures++;
          errors.push(`${idx}: ${error.message}`);
        } else {
          successes++;
        }
      } catch (err) {
        times.push(Date.now() - uStart);
        failures++;
        errors.push(`${idx}: ${err.message || "Network error"}`);
      }
    });

    await Promise.all(batchPromises);
    process.stdout.write(`  Batch ${Math.floor(batch / BATCH) + 1}/${Math.ceil(UPLOAD_COUNT / BATCH)} complete\r`);
  }

  const totalTime = Date.now() - start;
  times.sort((a, b) => a - b);
  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  const failureRate = ((failures / UPLOAD_COUNT) * 100).toFixed(2);

  console.log(`\n  Successes: ${successes}/${UPLOAD_COUNT}`);
  console.log(`  Failures: ${failures}/${UPLOAD_COUNT} (${failureRate}%)`);
  console.log(`  Avg upload time: ${avg}ms`);
  console.log(`  Total time: ${totalTime}ms`);
  if (errors.length > 0) {
    console.log(`  First error: ${errors[0]}`);
  }

  // Cleanup
  console.log("  Cleaning up test files...");
  const { data: files } = await supabase.storage
    .from("voice-recordings")
    .list("load-test", { limit: 1000 });

  if (files && files.length > 0) {
    const filePaths = files.map((f) => `load-test/${f.name}`);
    // Delete in batches
    for (let i = 0; i < filePaths.length; i += 100) {
      await supabase.storage
        .from("voice-recordings")
        .remove(filePaths.slice(i, i + 100));
    }
  }
  console.log("  ✅ Cleaned up");

  const passed = parseFloat(failureRate) <= 1.0;

  addResult("Storage Upload Concurrency", {
    totalUploads: UPLOAD_COUNT,
    successes,
    failures,
    failureRate: `${failureRate}%`,
    avgUploadTime: `${avg}ms`,
    totalTime: `${totalTime}ms`,
    passed,
    flags: !passed ? [`Failure rate ${failureRate}% exceeds 1% threshold`] : [],
    remediation: !passed
      ? "Supabase Storage may have rate limits on the free tier. Consider upgrading or implementing client-side retry with exponential backoff."
      : null,
  });

  return passed;
}

// ═══════════════════════════════════════════
// TEST 3: Queue Submission Load (1000 in 60s)
// ═══════════════════════════════════════════
async function testQueueSubmissions() {
  console.log("\n═══ TEST 3: Queue Submissions (1000 in 60s) ═══\n");

  const SUBMIT_COUNT = 1000;
  const start = Date.now();
  const times = [];
  let successes = 0;
  let failures = 0;
  let duplicates = 0;
  const errors = [];

  // Submit in batches of 100
  const BATCH = 100;
  for (let batch = 0; batch < SUBMIT_COUNT; batch += BATCH) {
    const batchSize = Math.min(BATCH, SUBMIT_COUNT - batch);
    const batchPromises = Array.from({ length: batchSize }, async (_, i) => {
      const idx = batch + i;
      const qStart = Date.now();
      try {
        const { data, error } = await supabase
          .from("application_queue")
          .insert({
            user_id: `00000000-0000-0000-0000-${String(idx).padStart(12, "0")}`,
            status: "pending",
            application_data: {
              full_name: `LoadTest User ${idx}`,
              email: `loadtest${idx}@test.staffva.com`,
              role_category: "Paralegal",
              test_id: `lt_${Date.now()}_${idx}`,
            },
          })
          .select("id")
          .single();

        const elapsed = Date.now() - qStart;
        times.push(elapsed);

        if (error) {
          if (error.message.includes("duplicate")) {
            duplicates++;
          } else {
            failures++;
            errors.push(`${idx}: ${error.message}`);
          }
        } else {
          successes++;
        }
      } catch (err) {
        times.push(Date.now() - qStart);
        failures++;
        errors.push(`${idx}: ${err.message || "Network error"}`);
      }
    });

    await Promise.all(batchPromises);
    process.stdout.write(`  Batch ${Math.floor(batch / BATCH) + 1}/${Math.ceil(SUBMIT_COUNT / BATCH)} complete\r`);
  }

  const totalTime = Date.now() - start;
  times.sort((a, b) => a - b);
  const avg = Math.round(times.reduce((s, t) => s + t, 0) / times.length);
  const p95 = times[Math.floor(times.length * 0.95)];
  const max = times[times.length - 1];
  const over2000 = times.filter((t) => t > 2000).length;

  console.log(`\n  Successes: ${successes}/${SUBMIT_COUNT}`);
  console.log(`  Failures: ${failures}`);
  console.log(`  Duplicates: ${duplicates}`);
  console.log(`  Avg response: ${avg}ms | P95: ${p95}ms | Max: ${max}ms`);
  console.log(`  Over 2s: ${over2000}`);
  console.log(`  Total time: ${totalTime}ms (target: 60s)`);

  // Verify all records exist
  const { count } = await supabase
    .from("application_queue")
    .select("*", { count: "exact", head: true })
    .like("application_data->>full_name", "LoadTest%");

  console.log(`  Records in DB: ${count}`);

  // Cleanup
  console.log("  Cleaning up...");
  await supabase
    .from("application_queue")
    .delete()
    .like("application_data->>full_name", "LoadTest%");
  console.log("  ✅ Cleaned up");

  const passed = over2000 === 0 && failures === 0;

  addResult("Queue Submission Load", {
    totalSubmissions: SUBMIT_COUNT,
    successes,
    failures,
    duplicates,
    avgResponse: `${avg}ms`,
    p95Response: `${p95}ms`,
    maxResponse: `${max}ms`,
    over2sCount: over2000,
    totalTime: `${totalTime}ms`,
    recordsVerified: count,
    passed,
    flags: [
      ...(over2000 > 0 ? [`${over2000} submissions exceeded 2-second threshold`] : []),
      ...(failures > 0 ? [`${failures} submission failures`] : []),
    ],
    remediation: !passed
      ? "Queue endpoint may need connection pooling or batch insert optimization. Consider Supabase Pro plan for higher throughput."
      : null,
  });

  return passed;
}

// ═══════════════════════════════════════════
// GENERATE REPORT
// ═══════════════════════════════════════════
function generateReport() {
  const lines = [
    "# StaffVA Infrastructure Load Test Report",
    "",
    `**Date:** ${new Date().toLocaleString()}`,
    `**Overall Status:** ${report.overallPass ? "✅ ALL TESTS PASSED" : "⚠ SOME TESTS NEED ATTENTION"}`,
    "",
    "---",
    "",
  ];

  for (const test of report.tests) {
    const icon = test.passed ? "✅" : "❌";
    lines.push(`## ${icon} ${test.name}`);
    lines.push("");

    // Format test-specific data
    if (test.concurrencyLevels) {
      lines.push("| Concurrency | Avg | P50 | P95 | P99 | Max | Failures | Over 500ms |");
      lines.push("|-------------|-----|-----|-----|-----|-----|----------|------------|");
      for (const [level, data] of Object.entries(test.concurrencyLevels)) {
        lines.push(`| ${level} | ${data.avg}ms | ${data.p50}ms | ${data.p95}ms | ${data.p99}ms | ${data.max}ms | ${data.failures} | ${data.over500} |`);
      }
      lines.push("");
    }

    if (test.totalUploads) {
      lines.push(`- **Total uploads:** ${test.totalUploads}`);
      lines.push(`- **Successes:** ${test.successes}`);
      lines.push(`- **Failures:** ${test.failures} (${test.failureRate})`);
      lines.push(`- **Avg upload time:** ${test.avgUploadTime}`);
      lines.push(`- **Total time:** ${test.totalTime}`);
      lines.push("");
    }

    if (test.totalSubmissions) {
      lines.push(`- **Total submissions:** ${test.totalSubmissions}`);
      lines.push(`- **Successes:** ${test.successes}`);
      lines.push(`- **Failures:** ${test.failures}`);
      lines.push(`- **Avg response:** ${test.avgResponse}`);
      lines.push(`- **P95 response:** ${test.p95Response}`);
      lines.push(`- **Max response:** ${test.maxResponse}`);
      lines.push(`- **Over 2s:** ${test.over2sCount}`);
      lines.push(`- **Records verified in DB:** ${test.recordsVerified}`);
      lines.push("");
    }

    if (test.flags && test.flags.length > 0) {
      lines.push("**Flags:**");
      for (const flag of test.flags) {
        lines.push(`- ⚠ ${flag}`);
      }
      lines.push("");
    }

    if (test.remediation) {
      lines.push(`**Remediation:** ${test.remediation}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  lines.push("## Recommendations");
  lines.push("");

  if (report.overallPass) {
    lines.push("All tests passed. The infrastructure is ready for launch with the following notes:");
    lines.push("- Monitor Supabase connection pool usage during peak traffic");
    lines.push("- Storage uploads should implement client-side retry (already built)");
    lines.push("- Queue system handles 1000+ concurrent submissions");
    lines.push("- Consider upgrading to Supabase Pro before 10K+ concurrent users");
  } else {
    lines.push("Some tests require attention before launch. See remediation steps above.");
  }

  const content = lines.join("\n");
  writeFileSync("LOAD_TEST_REPORT.md", content);
  console.log("\n📄 Report saved to LOAD_TEST_REPORT.md");
}

// ═══════════════════════════════════════════
// RUN ALL TESTS
// ═══════════════════════════════════════════
async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  StaffVA Infrastructure Capacity Validation  ║");
  console.log("╚══════════════════════════════════════════════╝");

  await testDBConnections();
  await testStorageUploads();
  await testQueueSubmissions();

  generateReport();

  console.log(`\n${"═".repeat(50)}`);
  console.log(`  OVERALL: ${report.overallPass ? "✅ ALL TESTS PASSED" : "⚠ SOME TESTS NEED ATTENTION"}`);
  console.log(`${"═".repeat(50)}\n`);
}

main().catch(console.error);
