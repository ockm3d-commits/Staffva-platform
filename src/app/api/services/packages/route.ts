import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — fetch service packages (by candidate_id or all active)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const candidateId = searchParams.get("candidateId");
  const ownPackages = searchParams.get("own") === "true";
  const category = searchParams.get("category");
  const statusFilter = searchParams.get("status");

  const supabase = getAdminClient();

  // Admin: fetch packages by status (e.g. pending_review)
  if (statusFilter) {
    const { data, error } = await supabase
      .from("service_packages")
      .select("*, candidates(display_name, role_category, reputation_tier)")
      .eq("status", statusFilter)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ packages: data || [] });
  }

  if (ownPackages) {
    // Candidate fetching their own packages (all statuses)
    const serverSupabase = await createServerSupabase();
    const { data: { user } } = await serverSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: candidate } = await supabase
      .from("candidates")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("service_packages")
      .select("*")
      .eq("candidate_id", candidate.id)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ packages: data || [] });
  }

  // Public: fetch active packages for a specific candidate or by category
  let query = supabase
    .from("service_packages")
    .select("*, candidates!inner(display_name, country, role_category, profile_photo_url, english_written_tier, speaking_level)")
    .eq("status", "active");

  if (candidateId) {
    query = query.eq("candidate_id", candidateId);
  }

  if (category) {
    query = query.ilike("category", `%${category}%`);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ packages: data || [] });
}

// POST — create a new service package
export async function POST(request: Request) {
  const serverSupabase = await createServerSupabase();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getAdminClient();

  // Get candidate record
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, admin_status, committed_hours")
    .eq("user_id", user.id)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  if (candidate.admin_status !== "approved") {
    return NextResponse.json({ error: "Only approved candidates can create service packages" }, { status: 403 });
  }

  // Check max 3 packages
  const { count } = await supabase
    .from("service_packages")
    .select("id", { count: "exact" })
    .eq("candidate_id", candidate.id);

  if ((count || 0) >= 3) {
    return NextResponse.json({ error: "Maximum 3 service packages allowed" }, { status: 400 });
  }

  const body = await request.json();
  const {
    title,
    description,
    whats_included,
    whats_not_included,
    delivery_days,
    price_usd,
    tier,
    category,
    max_concurrent_orders,
    status: packageStatus,
  } = body;

  // Validate required fields
  if (!title || !description || !delivery_days || !price_usd || !category) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (title.length > 80) {
    return NextResponse.json({ error: "Title must be 80 characters or less" }, { status: 400 });
  }

  if (description.length > 500) {
    return NextResponse.json({ error: "Description must be 500 characters or less" }, { status: 400 });
  }

  if (price_usd < 25) {
    return NextResponse.json({ error: "Minimum price is $25" }, { status: 400 });
  }

  // If candidate is at capacity, force draft status
  const effectiveStatus = candidate.committed_hours >= 35 ? "draft" : (packageStatus || "draft");

  const { data, error } = await supabase
    .from("service_packages")
    .insert({
      candidate_id: candidate.id,
      title,
      description,
      whats_included: whats_included || [],
      whats_not_included: whats_not_included || [],
      delivery_days,
      price_usd,
      tier: tier || "basic",
      category,
      max_concurrent_orders: max_concurrent_orders || 3,
      status: effectiveStatus,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ package: data });
}

// PATCH — update a service package
export async function PATCH(request: Request) {
  const serverSupabase = await createServerSupabase();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getAdminClient();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id, committed_hours")
    .eq("user_id", user.id)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const body = await request.json();
  const { id, ...updates } = body;

  if (!id) {
    return NextResponse.json({ error: "Package ID required" }, { status: 400 });
  }

  // Verify ownership
  const { data: existing } = await supabase
    .from("service_packages")
    .select("id, candidate_id")
    .eq("id", id)
    .eq("candidate_id", candidate.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Package not found or not owned by you" }, { status: 404 });
  }

  // Validate updates
  if (updates.title && updates.title.length > 80) {
    return NextResponse.json({ error: "Title must be 80 characters or less" }, { status: 400 });
  }

  if (updates.description && updates.description.length > 500) {
    return NextResponse.json({ error: "Description must be 500 characters or less" }, { status: 400 });
  }

  if (updates.price_usd && updates.price_usd < 25) {
    return NextResponse.json({ error: "Minimum price is $25" }, { status: 400 });
  }

  // If candidate is at capacity, don't allow setting to active
  if (updates.status === "active" && candidate.committed_hours >= 35) {
    return NextResponse.json({ error: "Cannot activate packages while at capacity (35+ hrs/week committed)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("service_packages")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ package: data });
}

// DELETE — delete a service package (only drafts, or paused with no active orders)
export async function DELETE(request: Request) {
  const serverSupabase = await createServerSupabase();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getAdminClient();

  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Package ID required" }, { status: 400 });
  }

  // Verify ownership
  const { data: pkg } = await supabase
    .from("service_packages")
    .select("id, candidate_id, status")
    .eq("id", id)
    .eq("candidate_id", candidate.id)
    .single();

  if (!pkg) {
    return NextResponse.json({ error: "Package not found" }, { status: 404 });
  }

  // Check for active orders
  const { count } = await supabase
    .from("service_orders")
    .select("id", { count: "exact" })
    .eq("service_package_id", id)
    .in("status", ["pending", "in_progress", "submitted"]);

  if ((count || 0) > 0) {
    return NextResponse.json({ error: "Cannot delete a package with active orders" }, { status: 400 });
  }

  const { error } = await supabase
    .from("service_packages")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
