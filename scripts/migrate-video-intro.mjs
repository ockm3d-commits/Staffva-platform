/**
 * Migration: video_intro feature
 * Run: node scripts/migrate-video-intro.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const SUPABASE_URL = "https://mshnsbblwgcpwuxwuevp.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zaG5zYmJsd2djcHd1eHd1ZXZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDEzMjYwOSwiZXhwIjoyMDg5NzA4NjA5fQ.VoSXw8GzKY0VqOkEjA_YJ-fYoaRMwi9yoO9shOxa3qY";

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runMigration() {
  console.log("\n🔧 Running video_intro migration...\n");

  const sql = readFileSync("supabase/migrations/00026_video_intro.sql", "utf-8");
  const { error } = await supabase.rpc("exec_sql", { query: sql });

  if (error) {
    console.log(`❌ Migration failed: ${error.message}`);
    return;
  }

  console.log("✅ Migration complete");
  await supabase.rpc("exec_sql", { query: "NOTIFY pgrst, 'reload schema';" });
  console.log("✅ Schema cache reloaded");

  // Verify
  const { data, error: verifyErr } = await supabase.from("video_intro_reviews").select("id").limit(0);
  console.log(verifyErr ? `❌ Verify failed: ${verifyErr.message}` : "✅ video_intro_reviews table verified");
}

runMigration().catch(console.error);
