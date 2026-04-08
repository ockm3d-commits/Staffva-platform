import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — fetch the assigned recruiter's profile for the authenticated candidate
// Uses service role to bypass profiles RLS (candidates can only read their own profile)
export async function GET(req: NextRequest) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getAdminClient();

  // Get this user's candidate record to find their assigned_recruiter
  const { data: candidate } = await admin
    .from("candidates")
    .select("id, assigned_recruiter")
    .eq("user_id", user.id)
    .single();

  if (!candidate || !candidate.assigned_recruiter) {
    return NextResponse.json({ recruiter_profile: null });
  }

  // Fetch the recruiter's profile using service role (bypasses RLS)
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, avatar_url, calendar_link")
    .eq("id", candidate.assigned_recruiter)
    .single();

  return NextResponse.json({ recruiter_profile: profile });
}
