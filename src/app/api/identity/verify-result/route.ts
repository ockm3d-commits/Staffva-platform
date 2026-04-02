import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import { createHash } from "crypto";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Generate SHA-256 identity hash from verified identity data.
 * Format: fullname_lowercase_trimmed|date_of_birth|document_number_uppercase_trimmed
 */
function generateIdentityHash(fullName: string, dob: string, documentNumber: string): string {
  const input = `${fullName.toLowerCase().trim()}|${dob}|${documentNumber.toUpperCase().trim()}`;
  return createHash("sha256").update(input).digest("hex");
}

// POST — Process a completed Stripe Identity verification
export async function POST(req: NextRequest) {
  try {
    const supabase = getAdminClient();
    const { candidateId, stripeSessionId } = await req.json();

    if (!candidateId || !stripeSessionId) {
      return NextResponse.json({ error: "Missing candidateId or stripeSessionId" }, { status: 400 });
    }

    // Retrieve the Stripe verification session with expanded data
    let session;
    try {
      session = await stripe.identity.verificationSessions.retrieve(stripeSessionId, {
        expand: ["verified_outputs"],
      });
    } catch (err) {
      // If Stripe Identity is not configured, allow dev bypass
      const msg = err instanceof Error ? err.message : "Unknown";
      if (msg.includes("No such") || msg.includes("not found") || msg.includes("configuration")) {
        // Dev mode — auto-pass without identity hash
        await supabase
          .from("candidates")
          .update({ id_verification_status: "passed" })
          .eq("id", candidateId);

        return NextResponse.json({
          scenario: "dev_bypass",
          message: "Stripe Identity not configured — dev bypass applied",
        });
      }
      return NextResponse.json({ error: `Stripe error: ${msg}` }, { status: 500 });
    }

    // Extract verified identity fields
    const outputs = session.verified_outputs as {
      first_name?: string;
      last_name?: string;
      dob?: { year?: number; month?: number; day?: number };
      id_number?: string;
      document?: { number?: string };
    } | null;

    if (!outputs) {
      return NextResponse.json({ error: "No verified outputs from Stripe" }, { status: 400 });
    }

    const fullName = `${outputs.first_name || ""} ${outputs.last_name || ""}`.trim();
    const dob = outputs.dob
      ? `${outputs.dob.year}-${String(outputs.dob.month).padStart(2, "0")}-${String(outputs.dob.day).padStart(2, "0")}`
      : "";
    const documentNumber = outputs.id_number || outputs.document?.number || "";

    if (!fullName || !dob) {
      // Incomplete data — flag for review but don't block
      await supabase
        .from("candidates")
        .update({ id_verification_status: "passed" })
        .eq("id", candidateId);

      return NextResponse.json({
        scenario: "incomplete_data",
        message: "Verification passed but identity hash could not be generated — incomplete data",
      });
    }

    const identityHash = generateIdentityHash(fullName, dob, documentNumber);

    // Check for existing identity record
    const { data: existingIdentity } = await supabase
      .from("verified_identities")
      .select("id, candidate_id, stripe_verification_session_id")
      .eq("identity_hash", identityHash)
      .single();

    // Check lockout status via database function
    const { data: lockoutResult } = await supabase.rpc("check_identity_lockout", {
      p_identity_hash: identityHash,
    });

    const lockout = lockoutResult as { is_locked: boolean; lockout_expires_at: string | null; original_candidate_id: string | null } | null;

    // ═══ SCENARIO A: No existing record, no lockout ═══
    if (!existingIdentity) {
      await supabase.from("verified_identities").insert({
        identity_hash: identityHash,
        stripe_verification_session_id: stripeSessionId,
        candidate_id: candidateId,
        is_duplicate: false,
      });

      await supabase
        .from("candidates")
        .update({ id_verification_status: "passed" })
        .eq("id", candidateId);

      return NextResponse.json({
        scenario: "A",
        message: "New identity verified — proceed to English test",
        proceed: true,
      });
    }

    // Existing record found — check scenarios B, C, D
    const originalCandidateId = existingIdentity.candidate_id;
    const originalSessionId = existingIdentity.stripe_verification_session_id;

    // ═══ SCENARIO D: Potential hash collision ═══
    // Different Stripe sessions with same hash but different underlying data
    // This is extremely rare but must be handled
    if (originalSessionId && stripeSessionId !== originalSessionId) {
      // Check if both sessions have different verified names
      // (would indicate a true collision, not a duplicate person)
      let isLikelyCollision = false;

      try {
        const originalSession = await stripe.identity.verificationSessions.retrieve(originalSessionId, {
          expand: ["verified_outputs"],
        });
        const origOutputs = originalSession.verified_outputs as { first_name?: string; last_name?: string } | null;
        const origName = `${origOutputs?.first_name || ""} ${origOutputs?.last_name || ""}`.trim().toLowerCase();
        const currentName = fullName.toLowerCase();

        // If names are significantly different, it's likely a collision
        if (origName && currentName && origName !== currentName) {
          isLikelyCollision = true;
        }
      } catch {
        // Can't verify — treat as potential collision
        isLikelyCollision = true;
      }

      if (isLikelyCollision) {
        // Flag for review but allow to proceed
        // Flag existing record for review (don't insert duplicate hash)
        await supabase
          .from("verified_identities")
          .update({
            flagged_for_review: true,
            review_reason: `potential_collision_detected — new_candidate: ${candidateId}, new_session: ${stripeSessionId}`,
          })
          .eq("identity_hash", identityHash);

        await supabase
          .from("candidates")
          .update({ id_verification_status: "passed" })
          .eq("id", candidateId);

        // Alert admin
        if (process.env.RESEND_API_KEY) {
          try {
            await resend.emails.send({
              from: "StaffVA <notifications@staffva.com>",
              to: "sam@glostaffing.com",
              subject: "⚠ Potential identity hash collision detected",
              html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
                <h2 style="color:#1C1B1A;">Identity Hash Collision Alert</h2>
                <p style="color:#444;font-size:14px;">Two different Stripe Identity sessions produced the same identity hash but may represent different people.</p>
                <div style="background:#f9f9f9;border:1px solid #e0e0e0;border-radius:8px;padding:16px;margin:16px 0;">
                  <p style="margin:0 0 6px;font-size:14px;"><strong>Original candidate:</strong> ${originalCandidateId}</p>
                  <p style="margin:0 0 6px;font-size:14px;"><strong>New candidate:</strong> ${candidateId}</p>
                  <p style="margin:0 0 6px;font-size:14px;"><strong>Original Stripe session:</strong> ${originalSessionId}</p>
                  <p style="margin:0;font-size:14px;"><strong>New Stripe session:</strong> ${stripeSessionId}</p>
                </div>
                <p style="color:#444;font-size:14px;">The new candidate has been allowed to proceed. Review both accounts manually.</p>
                <a href="https://staffva.com/admin/candidates" style="display:inline-block;background:#FE6E3E;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;margin-top:16px;">Review in Admin</a>
              </div>`,
            });
          } catch { /* silent */ }
        }

        return NextResponse.json({
          scenario: "D",
          message: "Potential collision flagged for review — candidate may proceed",
          proceed: true,
        });
      }
    }

    // ═══ SCENARIO B: Existing record + active lockout ═══
    if (lockout && lockout.is_locked) {
      // Block candidate
      await supabase
        .from("candidates")
        .update({ admin_status: "duplicate_blocked" })
        .eq("id", candidateId);

      // Log duplicate attempt
      await supabase.from("verified_identities").insert({
        identity_hash: identityHash + "_dup_" + Date.now(),
        stripe_verification_session_id: stripeSessionId,
        candidate_id: candidateId,
        is_duplicate: true,
        duplicate_of_candidate_id: originalCandidateId,
      });

      const expiryDate = lockout.lockout_expires_at
        ? new Date(lockout.lockout_expires_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
        : "soon";

      return NextResponse.json({
        scenario: "B",
        message: "duplicate_detected",
        proceed: false,
        lockout_expires: expiryDate,
        display_message: `It looks like you may already have a StaffVA account associated with this identity. If you have an existing account, visit staffva.com/login. Your English assessment will be available on ${expiryDate}. If you believe this is an error, contact support@staffva.com.`,
      });
    }

    // ═══ SCENARIO C: Existing record, no active lockout ═══
    // Original account eligible for retake — freeze current, redirect to original
    await supabase
      .from("candidates")
      .update({ admin_status: "duplicate_blocked" })
      .eq("id", candidateId);

    await supabase.from("verified_identities").insert({
      identity_hash: identityHash + "_merge_" + Date.now(),
      stripe_verification_session_id: stripeSessionId,
      candidate_id: candidateId,
      is_duplicate: true,
      duplicate_of_candidate_id: originalCandidateId,
    });

    return NextResponse.json({
      scenario: "C",
      message: "existing_account_found",
      proceed: false,
      original_candidate_id: originalCandidateId,
      display_message: "An existing StaffVA account was found with this identity. Please sign in with your original account to continue. Contact support@staffva.com if you need help accessing your account.",
    });
  } catch (err) {
    console.error("Identity verification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
