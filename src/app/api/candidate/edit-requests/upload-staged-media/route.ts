import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Field → bucket map for media staging.
const FIELD_BUCKET: Record<string, string> = {
  profile_photo_url: "profile-photos",
  voice_recording_1_url: "voice-recordings",
  voice_recording_2_url: "voice-recordings",
  video_intro_url: "video-intros",
};

// POST /api/candidate/edit-requests/upload-staged-media
// Accepts: multipart/form-data with `file` (Blob) and `field_name` (string).
// Generates a reservation UUID, uploads to {bucket}/staged/{uuid}.{ext},
// returns { staged_path, reserved_id }. Caller then POSTs
// /api/candidate/edit-requests with new_value = staged_path.
//
// The reserved_id is NOT written to profile_edit_requests here — it exists
// only to make the staged filename unique. The subsequent create-request
// call owns the DB row.
export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const admin = getAdminClient();
  const { data: candidate } = await admin
    .from("candidates")
    .select("id, assigned_recruiter")
    .eq("user_id", user.id)
    .single();
  if (!candidate) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  if (!candidate.assigned_recruiter) {
    return NextResponse.json({ error: "No recruiter assigned" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart body" }, { status: 400 });
  }

  const file = form.get("file");
  const fieldName = form.get("field_name");

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (typeof fieldName !== "string" || !FIELD_BUCKET[fieldName]) {
    return NextResponse.json({ error: "Invalid field_name" }, { status: 400 });
  }

  const bucket = FIELD_BUCKET[fieldName];
  const reservedId = randomUUID();

  // Derive extension from the File name when available, otherwise MIME fallback.
  let ext = "bin";
  const asFile = file as File;
  if (asFile.name && asFile.name.includes(".")) {
    ext = asFile.name.split(".").pop()!.toLowerCase();
  } else if (file.type) {
    const m = file.type.split("/");
    if (m.length === 2) ext = m[1].toLowerCase();
  }

  const storagePath = `staged/${reservedId}.${ext}`;
  const publicPath = `${bucket}/${storagePath}`;

  const { error: uploadErr } = await admin.storage
    .from(bucket)
    .upload(storagePath, file, { contentType: file.type || undefined, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: `Upload failed: ${uploadErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ staged_path: publicPath, reserved_id: reservedId });
}
