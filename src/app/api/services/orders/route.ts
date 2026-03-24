import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET — fetch orders for the current user (candidate or client)
export async function GET(request: Request) {
  const serverSupabase = await createServerSupabase();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getAdminClient();
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "candidate";
  const status = searchParams.get("status");

  if (role === "client") {
    // Client viewing their purchases
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    let query = supabase
      .from("service_orders")
      .select("*, service_packages(title, delivery_days, category), candidates(display_name, profile_photo_url, country)")
      .eq("client_id", client.id)
      .order("ordered_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data || [] });
  }

  // Candidate viewing their orders
  const { data: candidate } = await supabase
    .from("candidates")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  let query = supabase
    .from("service_orders")
    .select("*, service_packages(title, delivery_days, category), clients(full_name)")
    .eq("candidate_id", candidate.id)
    .order("ordered_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Mask client name to first name only
  const masked = (data || []).map((order: Record<string, unknown>) => {
    const clients = order.clients as { full_name: string } | null;
    return {
      ...order,
      clients: clients ? {
        full_name: (clients.full_name || "").split(" ")[0],
      } : null,
    };
  });

  return NextResponse.json({ orders: masked });
}

// PATCH — update an order (submit delivery, approve, request revision, cancel)
export async function PATCH(request: Request) {
  const serverSupabase = await createServerSupabase();
  const { data: { user } } = await serverSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = getAdminClient();
  const body = await request.json();
  const { orderId, action, delivery_message, delivery_url, revision_note } = body;

  if (!orderId || !action) {
    return NextResponse.json({ error: "Order ID and action required" }, { status: 400 });
  }

  // Fetch the order
  const { data: order, error: orderError } = await supabase
    .from("service_orders")
    .select("*, service_packages(title, price_usd)")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  switch (action) {
    case "submit_delivery": {
      // Candidate submits their work
      const { data: candidate } = await supabase
        .from("candidates")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!candidate || candidate.id !== order.candidate_id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      if (order.status !== "in_progress") {
        return NextResponse.json({ error: "Can only submit delivery for in-progress orders" }, { status: 400 });
      }

      const now = new Date();
      const autoRelease = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const { data, error } = await supabase
        .from("service_orders")
        .update({
          status: "submitted",
          delivery_message: delivery_message || null,
          delivery_url: delivery_url || null,
          submitted_at: now.toISOString(),
          auto_release_at: autoRelease.toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ order: data });
    }

    case "approve": {
      // Client approves and releases funds
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!client || client.id !== order.client_id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      if (order.status !== "submitted") {
        return NextResponse.json({ error: "Can only approve submitted orders" }, { status: 400 });
      }

      const now = new Date();

      // Update order status
      const { data, error } = await supabase
        .from("service_orders")
        .update({
          status: "approved",
          approved_at: now.toISOString(),
          released_at: now.toISOString(),
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Update candidate earnings
      await supabase.rpc("increment_earnings", {
        p_candidate_id: order.candidate_id,
        p_amount: order.candidate_amount_usd,
      }).then(() => {}).catch(() => {
        // Fallback: direct update
        supabase
          .from("candidates")
          .select("total_earnings_usd")
          .eq("id", order.candidate_id)
          .single()
          .then(({ data: cand }) => {
            if (cand) {
              supabase
                .from("candidates")
                .update({ total_earnings_usd: (cand.total_earnings_usd || 0) + order.candidate_amount_usd })
                .eq("id", order.candidate_id)
                .then(() => {});
            }
          });
      });

      return NextResponse.json({ order: data });
    }

    case "request_revision": {
      // Client requests revision
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!client || client.id !== order.client_id) {
        return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }

      if (order.status !== "submitted") {
        return NextResponse.json({ error: "Can only request revision on submitted orders" }, { status: 400 });
      }

      if (!revision_note || revision_note.length < 10) {
        return NextResponse.json({ error: "Revision note must be at least 10 characters" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("service_orders")
        .update({
          status: "in_progress",
          revision_note,
          submitted_at: null,
          auto_release_at: null,
          delivery_message: null,
          delivery_url: null,
        })
        .eq("id", orderId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ order: data });
    }

    case "cancel": {
      // Either party can cancel if status is pending
      if (order.status !== "pending") {
        return NextResponse.json({ error: "Can only cancel pending orders" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("service_orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ order: data });
    }

    case "dispute": {
      // Either party can dispute a submitted order
      if (!["submitted", "in_progress"].includes(order.status)) {
        return NextResponse.json({ error: "Can only dispute active orders" }, { status: 400 });
      }

      const { data, error } = await supabase
        .from("service_orders")
        .update({ status: "disputed" })
        .eq("id", orderId)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ order: data });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
