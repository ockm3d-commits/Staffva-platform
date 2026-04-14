import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateInterviewToken } from "@/lib/interviewToken";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: candidate, error } = await supabase
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (error || !candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const token = await generateInterviewToken(candidate.id);
  return NextResponse.json({ token });
}
