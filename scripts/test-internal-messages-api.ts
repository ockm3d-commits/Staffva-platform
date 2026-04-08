/**
 * Test internal messages — check if sender names are returned
 * npx tsx scripts/test-internal-messages-api.ts
 */
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  "https://mshnsbblwgcpwuxwuevp.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEAM_THREAD_ID = "00000000-0000-0000-0000-000000000001";

async function main() {
  // Get a team member to send a test message as
  const { data: members } = await admin
    .from("internal_thread_members")
    .select("profile_id, profiles!inner(full_name)")
    .eq("thread_id", TEAM_THREAD_ID)
    .limit(2);

  const sender = members?.[0];
  const sender2 = members?.[1];
  if (!sender || !sender2) { console.log("No members"); return; }

  console.log("Sender 1:", sender.profile_id, (sender.profiles as any)?.full_name);
  console.log("Sender 2:", sender2.profile_id, (sender2.profiles as any)?.full_name);

  // Insert two test messages from different senders
  await admin.from("internal_messages").insert([
    { thread_id: TEAM_THREAD_ID, sender_id: sender.profile_id, body: "Test msg from sender 1" },
    { thread_id: TEAM_THREAD_ID, sender_id: sender2.profile_id, body: "Test msg from sender 2" },
  ]);

  // Now fetch messages with profiles join — same as the API does
  const { data: msgs, error } = await admin
    .from("internal_messages")
    .select("id, sender_id, body, created_at, profiles!inner(id, full_name)")
    .eq("thread_id", TEAM_THREAD_ID)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) { console.log("ERROR:", error.message); return; }

  console.log("\nMessages with profiles join:");
  for (const m of msgs || []) {
    console.log({
      body: m.body,
      sender_id: m.sender_id,
      profiles_raw: m.profiles,
      profiles_type: Array.isArray(m.profiles) ? "ARRAY" : "OBJECT",
      derived_name: (m.profiles as any)?.full_name || ((m.profiles as any)?.[0]?.full_name) || "MISSING",
    });
  }

  // Clean up test messages
  await admin.from("internal_messages")
    .delete()
    .in("body", ["Test msg from sender 1", "Test msg from sender 2"]);
  console.log("\nCleanup done.");
}

main().catch(console.error);
