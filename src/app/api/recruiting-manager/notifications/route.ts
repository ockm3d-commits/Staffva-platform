import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
  } = await createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ).auth.getUser(token);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "recruiting_manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { notificationId } = await req.json();
  if (!notificationId) {
    return NextResponse.json(
      { error: "Missing notificationId" },
      { status: 400 }
    );
  }

  await supabase
    .from("manager_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("manager_id", user.id);

  return NextResponse.json({ success: true });
}
