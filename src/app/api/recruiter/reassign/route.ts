import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST — Reassign a candidate from "Needs Routing" to a specific recruiter
export async function POST(req: NextRequest) {
  const supabase = getAdminClient();

  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ).auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "recruiter" && profile.role !== "admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { candidateId, newRecruiterId } = await req.json();
  if (!candidateId || !newRecruiterId) {
    return NextResponse.json({ error: "Missing candidateId or newRecruiterId" }, { status: 400 });
  }

  // Get candidate info for the notification message
  const { data: candidate } = await supabase
    .from("candidates")
    .select("display_name, full_name, role_category, assignment_pending_review")
    .eq("id", candidateId)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (!candidate.assignment_pending_review) {
    return NextResponse.json({ error: "Candidate is not pending routing" }, { status: 400 });
  }

  // Get new recruiter name
  const { data: newRecruiter } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", newRecruiterId)
    .single();

  if (!newRecruiter) {
    return NextResponse.json({ error: "Recruiter not found" }, { status: 404 });
  }

  // Update candidate: assign to new recruiter, clear pending flag
  const { error: updateError } = await supabase
    .from("candidates")
    .update({
      assigned_recruiter: newRecruiterId,
      assignment_pending_review: false,
    })
    .eq("id", candidateId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Create platform notification for the newly assigned recruiter
  const candidateName = candidate.display_name || candidate.full_name || "A candidate";
  await supabase.from("recruiter_notifications").insert({
    recruiter_id: newRecruiterId,
    candidate_id: candidateId,
    message: `${candidateName} (${candidate.role_category}) has been routed to you by ${profile.full_name || "Manar"}.`,
  });

  return NextResponse.json({ success: true });
}
