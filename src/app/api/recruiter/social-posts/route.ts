import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function getRecruiterUser(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ).auth.getUser(token);
  if (!user) return null;
  const supabase = getAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["recruiter", "recruiting_manager"].includes(profile.role)) return null;
  return user;
}

// GET — today's posts for this recruiter
export async function GET(req: NextRequest) {
  const user = await getRecruiterUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = getAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: posts } = await supabase
    .from("social_posts")
    .select("id, post_url, post_date, created_at")
    .eq("recruiter_id", user.id)
    .eq("post_date", today)
    .order("created_at", { ascending: true });

  return NextResponse.json({ posts: posts || [] });
}

// POST — log a social post
export async function POST(req: NextRequest) {
  const user = await getRecruiterUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postUrl } = await req.json();
  if (!postUrl || typeof postUrl !== "string") {
    return NextResponse.json({ error: "post_url is required" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const today = new Date().toISOString().split("T")[0];

  // Check existing count
  const { count } = await supabase
    .from("social_posts")
    .select("id", { count: "exact", head: true })
    .eq("recruiter_id", user.id)
    .eq("post_date", today);

  if ((count ?? 0) >= 2) {
    return NextResponse.json({ error: "Maximum 2 posts per day already logged" }, { status: 409 });
  }

  const { data, error } = await supabase
    .from("social_posts")
    .insert({ recruiter_id: user.id, post_url: postUrl.trim(), post_date: today })
    .select("id, post_url, post_date, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ post: data });
}
