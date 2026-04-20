import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { isMediaField, MEDIA_FIELD_BUCKET } from "@/lib/editFieldLabels";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/candidate/edit-requests/[id]/cancel
// Candidate-only. Moves status pending → cancelled. Cleans up staged media.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = getAdminClient();

  const { data: candidate } = await admin
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

  const { data: editRequest } = await admin
    .from("profile_edit_requests")
    .select("id, candidate_id, field_name, new_value, status, chat_message_id")
    .eq("id", id)
    .single();

  if (!editRequest) return NextResponse.json({ error: "Edit request not found" }, { status: 404 });
  if (editRequest.candidate_id !== candidate.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (editRequest.status !== "pending") {
    return NextResponse.json({ error: `Cannot cancel request with status ${editRequest.status}` }, { status: 400 });
  }

  // Delete staged file if this was a media edit.
  if (isMediaField(editRequest.field_name) && typeof editRequest.new_value === "string") {
    const bucket = MEDIA_FIELD_BUCKET[editRequest.field_name];
    const path = editRequest.new_value.replace(`${bucket}/`, "");
    if (path) await admin.storage.from(bucket).remove([path]);
  }

  const { error: updateErr } = await admin
    .from("profile_edit_requests")
    .update({
      status: "cancelled",
      resolved_at: new Date().toISOString(),
      resolved_by: null,
    })
    .eq("id", id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Append cancellation tag to the associated chat message.
  if (editRequest.chat_message_id) {
    const { data: msg } = await admin
      .from("recruiter_messages")
      .select("body")
      .eq("id", editRequest.chat_message_id)
      .single();
    if (msg) {
      await admin
        .from("recruiter_messages")
        .update({ body: `${msg.body} [Cancelled by candidate]` })
        .eq("id", editRequest.chat_message_id);
    }
  }

  return NextResponse.json({ id, status: "cancelled" });
}
