import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This endpoint runs SQL migrations against Supabase
// Protected: only works with the service role key as bearer token
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!authHeader || authHeader.replace("Bearer ", "") !== serviceKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { sql } = await req.json();
  if (!sql) {
    return NextResponse.json({ error: "No SQL provided" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("exec_sql", { query: sql });

  if (error) {
    // Fallback: try running via raw SQL through PostgREST
    return NextResponse.json({ error: error.message, hint: "Run this SQL in Supabase dashboard" }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
