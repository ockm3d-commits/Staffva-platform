import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { Resend } from "resend";
import { calculateReputationForCandidate } from "@/lib/reputation";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * POST /api/services/purchase
 * Actions: create_order, submit_delivery, approve, request_revision, submit_review
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = getAdminClient();
    const body = await req.json();
    const { action } = body;

    // ═══ CREATE ORDER ═══
    if (action === "create_order") {
      const { packageId, tierSelected, requirementsText } = body;
      if (!packageId || !requirementsText?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

      const { data: client } = await admin.from("clients").select("id").eq("user_id", user.id).single();
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

      const { data: pkg } = await admin.from("service_packages").select("*").eq("id", packageId).single();
      if (!pkg) return NextResponse.json({ error: "Service not found" }, { status: 404 });

      // Determine price based on tier
      let price = Number(pkg.price_usd);
      if (tierSelected === 2 && pkg.tier_2_price) price = Number(pkg.tier_2_price);
      if (tierSelected === 3 && pkg.tier_3_price) price = Number(pkg.tier_3_price);

      const deliveryDueAt = new Date(Date.now() + (pkg.delivery_days || 3) * 24 * 60 * 60 * 1000).toISOString();

      const { data: order, error: orderErr } = await admin.from("service_orders").insert({
        service_package_id: packageId,
        client_id: client.id,
        candidate_id: pkg.candidate_id,
        amount_paid_usd: price,
        platform_fee_usd: Math.round(price * 0.1 * 100) / 100,
        candidate_amount_usd: price,
        status: "in_progress",
        requirements_text: requirementsText.trim(),
        tier_selected: tierSelected || 1,
        delivery_due_at: deliveryDueAt,
        ordered_at: new Date().toISOString(),
      }).select().single();

      if (orderErr) return NextResponse.json({ error: orderErr.message }, { status: 500 });

      // Notify professional
      const { data: candidate } = await admin.from("candidates").select("email, display_name").eq("id", pkg.candidate_id).single();
      if (process.env.RESEND_API_KEY && candidate?.email) {
        const firstName = (candidate.display_name || "").split(" ")[0] || "there";
        try {
          await resend.emails.send({
            from: "StaffVA <notifications@staffva.com>",
            to: candidate.email,
            subject: "New order received — a client is waiting",
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <h2 style="color:#1C1B1A;">You have a new order</h2>
              <p style="color:#444;font-size:14px;">Hi ${firstName}, a client just purchased your service: <strong>${pkg.title}</strong>.</p>
              <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0 0 8px;font-size:14px;"><strong>Amount:</strong> $${price}</p>
                <p style="margin:0;font-size:14px;"><strong>Delivery due:</strong> ${new Date(deliveryDueAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p>
              </div>
              <a href="https://staffva.com/services" style="display:inline-block;background:#FE6E3E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">View Order & Brief</a>
              <p style="color:#999;margin-top:24px;font-size:12px;">— The StaffVA Team</p>
            </div>`,
          });
        } catch { /* silent */ }
      }

      return NextResponse.json({ order });
    }

    // ═══ SUBMIT DELIVERY ═══
    if (action === "submit_delivery") {
      const { orderId, deliveryMessage, deliveryContentUrl } = body;

      const { data: candidate } = await admin.from("candidates").select("id").eq("user_id", user.id).single();
      if (!candidate) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { data: order } = await admin.from("service_orders").select("*, clients(email, full_name)").eq("id", orderId).eq("candidate_id", candidate.id).single();
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      await admin.from("service_orders").update({
        status: "submitted",
        delivered_at: new Date().toISOString(),
        delivery_message: deliveryMessage?.trim() || null,
        delivery_content_url: deliveryContentUrl || null,
        auto_release_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }).eq("id", orderId);

      // Notify client
      const clientInfo = order.clients as { email: string; full_name: string } | null;
      if (process.env.RESEND_API_KEY && clientInfo?.email) {
        const { data: cand } = await admin.from("candidates").select("display_name").eq("id", candidate.id).single();
        try {
          await resend.emails.send({
            from: "StaffVA <notifications@staffva.com>",
            to: clientInfo.email,
            subject: `Your delivery from ${cand?.display_name || "your professional"} is ready`,
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <h2 style="color:#1C1B1A;">Your delivery is ready</h2>
              <p style="color:#444;font-size:14px;">${cand?.display_name || "Your professional"} has delivered your order. Review the delivery and approve it to release payment.</p>
              <a href="https://staffva.com/services" style="display:inline-block;background:#FE6E3E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Review Delivery</a>
              <p style="color:#999;margin-top:24px;font-size:12px;">Payment will auto-release in 7 days if not reviewed. — The StaffVA Team</p>
            </div>`,
          });
        } catch { /* silent */ }
      }

      return NextResponse.json({ success: true });
    }

    // ═══ APPROVE ═══
    if (action === "approve") {
      const { orderId } = body;

      const { data: client } = await admin.from("clients").select("id").eq("user_id", user.id).single();
      if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { data: order } = await admin.from("service_orders").select("*").eq("id", orderId).eq("client_id", client.id).single();
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      await admin.from("service_orders").update({
        status: "approved",
        approved_at: new Date().toISOString(),
      }).eq("id", orderId);

      // Update candidate earnings
      await admin.rpc("exec_sql", {
        query: `UPDATE candidates SET total_earnings_usd = total_earnings_usd + ${Number(order.candidate_amount_usd)} WHERE id = '${order.candidate_id}'`,
      });

      return NextResponse.json({ success: true });
    }

    // ═══ REQUEST REVISION ═══
    if (action === "request_revision") {
      const { orderId, revisionReason } = body;
      if (!revisionReason?.trim()) return NextResponse.json({ error: "Reason required" }, { status: 400 });

      const { data: client } = await admin.from("clients").select("id").eq("user_id", user.id).single();
      if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { data: order } = await admin.from("service_orders").select("*, candidates(email, display_name)").eq("id", orderId).eq("client_id", client.id).single();
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      await admin.from("service_orders").update({
        status: "in_progress",
        revision_count: (order.revision_count || 0) + 1,
        revision_requested_at: new Date().toISOString(),
        revision_reason: revisionReason.trim(),
        delivered_at: null,
        delivery_message: null,
      }).eq("id", orderId);

      // Notify professional
      const candInfo = order.candidates as { email: string; display_name: string } | null;
      if (process.env.RESEND_API_KEY && candInfo?.email) {
        try {
          await resend.emails.send({
            from: "StaffVA <notifications@staffva.com>",
            to: candInfo.email,
            subject: "Revision requested on your delivery",
            html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
              <h2 style="color:#1C1B1A;">Revision Requested</h2>
              <p style="color:#444;font-size:14px;">Your client has requested a revision:</p>
              <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:16px;margin:16px 0;">
                <p style="margin:0;color:#9A3412;font-size:13px;font-style:italic;">"${revisionReason.trim()}"</p>
              </div>
              <a href="https://staffva.com/services" style="display:inline-block;background:#FE6E3E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:8px;">View Order</a>
            </div>`,
          });
        } catch { /* silent */ }
      }

      return NextResponse.json({ success: true });
    }

    // ═══ SUBMIT REVIEW ═══
    if (action === "submit_review") {
      const { orderId, rating, reviewBody } = body;
      if (!rating || rating < 1 || rating > 5) return NextResponse.json({ error: "Rating 1-5 required" }, { status: 400 });

      const { data: client } = await admin.from("clients").select("id").eq("user_id", user.id).single();
      if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

      const { data: order } = await admin.from("service_orders").select("*").eq("id", orderId).eq("client_id", client.id).single();
      if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

      // Insert review
      await admin.from("reviews").insert({
        candidate_id: order.candidate_id,
        client_id: client.id,
        rating,
        body: reviewBody?.trim() || null,
        published: true,
      });

      await admin.from("service_orders").update({ review_submitted: true }).eq("id", orderId);

      // Recalculate reputation
      try {
        const breakdown = await calculateReputationForCandidate(order.candidate_id, admin);
        await admin.from("candidates").update({
          reputation_score: breakdown.totalScore,
          reputation_tier: breakdown.tier,
        }).eq("id", order.candidate_id);
      } catch { /* non-fatal */ }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Purchase flow error:", error);
    return NextResponse.json({ error: "Failed to process" }, { status: 500 });
  }
}

/**
 * GET /api/services/purchase?orderId=xxx
 * Returns order details for the authenticated user
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = getAdminClient();
    const orderId = req.nextUrl.searchParams.get("orderId");
    if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

    const { data: order } = await admin
      .from("service_orders")
      .select("*, service_packages(title, description, whats_included, delivery_days, outcome_category), candidates(display_name, profile_photo_url, role_category, reputation_tier), clients(full_name)")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ order });
  } catch (error) {
    console.error("Get order error:", error);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}
