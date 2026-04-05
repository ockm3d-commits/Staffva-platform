"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ServicePackage {
  id: string;
  title: string;
  description: string;
  whats_included: string[];
  delivery_days: number;
  price_usd: number;
  tier_2_label: string | null;
  tier_2_price: number | null;
  tier_3_label: string | null;
  tier_3_price: number | null;
  candidates: {
    id: string;
    display_name: string;
    profile_photo_url: string | null;
    role_category: string;
    reputation_tier: string | null;
  } | null;
}

const STEPS = ["Confirm", "Brief", "Payment", "Confirmed"];

export default function PurchasePage() {
  const params = useParams();
  const router = useRouter();
  const packageId = params.packageId as string;

  const [pkg, setPkg] = useState<ServicePackage | null>(null);
  const [step, setStep] = useState(1);
  const [tierSelected, setTierSelected] = useState(1);
  const [brief, setBrief] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [deliveryDueAt, setDeliveryDueAt] = useState("");

  // Review state (Step 5 after delivery)
  const [rating, setRating] = useState(0);
  const [reviewBody, setReviewBody] = useState("");

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/services/packages?candidateId=all&packageId=${packageId}`);
      // Fallback — fetch via browse
      const browseRes = await fetch(`/api/services/browse`);
      const browseData = await browseRes.json();
      const found = (browseData.services || []).find((s: ServicePackage) => s.id === packageId);
      if (found) setPkg(found);
      setLoading(false);
    }
    load();
  }, [packageId]);

  const price = tierSelected === 3 && pkg?.tier_3_price ? Number(pkg.tier_3_price)
    : tierSelected === 2 && pkg?.tier_2_price ? Number(pkg.tier_2_price)
    : Number(pkg?.price_usd || 0);

  const candidate = pkg?.candidates;
  const firstName = (candidate?.display_name || "").split(" ")[0] || "the professional";

  async function handleCreateOrder() {
    if (brief.trim().length < 50) { setError("Please provide at least 50 characters describing what you need."); return; }
    setSubmitting(true);
    setError("");

    const res = await fetch("/api/services/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create_order",
        packageId,
        tierSelected,
        requirementsText: brief.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error || "Failed to place order"); setSubmitting(false); return; }

    setOrderId(data.order?.id);
    const dueDate = new Date(Date.now() + (pkg?.delivery_days || 3) * 24 * 60 * 60 * 1000);
    setDeliveryDueAt(dueDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }));
    setStep(4);
    setSubmitting(false);
  }

  async function handleSubmitReview() {
    if (rating < 1) return;
    setSubmitting(true);
    await fetch("/api/services/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_review", orderId, rating, reviewBody: reviewBody.trim() }),
    });
    setSubmitting(false);
    router.push("/services");
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <h1 className="text-xl font-semibold text-text">Service not found</h1>
        <Link href="/services" className="mt-4 inline-block text-sm text-primary hover:underline">Browse services</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      {/* Progress */}
      {step <= 3 && (
        <div className="flex items-center justify-center gap-3 mb-8">
          {STEPS.slice(0, 3).map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                i + 1 < step ? "bg-primary text-white" : i + 1 === step ? "bg-primary/20 text-primary border-2 border-primary" : "bg-gray-100 text-gray-400"
              }`}>
                {i + 1 < step ? "✓" : i + 1}
              </div>
              <span className={`text-xs ${i + 1 <= step ? "text-text font-medium" : "text-gray-400"}`}>{label}</span>
              {i < 2 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>
      )}

      {/* ═══ STEP 1: Confirm ═══ */}
      {step === 1 && (
        <div>
          <h1 className="text-2xl font-bold text-text">Confirm your selection</h1>

          <div className="mt-6 rounded-2xl border border-border-light bg-card overflow-hidden">
            <div className="bg-[#1C1B1A] px-5 py-4 flex items-center gap-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/20">
                {candidate?.profile_photo_url ? (
                  <img src={candidate.profile_photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white/60">{candidate?.display_name?.[0] || "?"}</div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-white">{candidate?.display_name}</p>
                  {candidate?.reputation_tier && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${candidate.reputation_tier === "Elite" ? "bg-amber-700 text-amber-100" : "bg-primary text-white"}`}>
                      {candidate.reputation_tier}
                    </span>
                  )}
                </div>
                <p className="text-xs text-white/50">{candidate?.role_category}</p>
              </div>
            </div>

            <div className="px-5 py-5">
              <h2 className="text-lg font-semibold text-text">{pkg.title}</h2>
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                Delivers in {pkg.delivery_days} day{pkg.delivery_days !== 1 ? "s" : ""}
              </span>
              <ul className="mt-3 space-y-1.5">
                {(pkg.whats_included || []).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                    <svg className="h-4 w-4 mt-0.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-border-light px-5 py-4 flex items-center justify-between">
              <p className="text-2xl font-bold text-text">${price}</p>
              <Link href={`/inbox?candidate=${candidate?.id}`} className="text-xs text-primary hover:underline">
                Have a question? Message {firstName}
              </Link>
            </div>
          </div>

          <button onClick={() => setStep(2)} className="mt-6 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
            Continue to Brief
          </button>
        </div>
      )}

      {/* ═══ STEP 2: Brief ═══ */}
      {step === 2 && (
        <div>
          <h1 className="text-2xl font-bold text-text">Tell {firstName} what you need</h1>
          <p className="mt-1 text-sm text-text-muted">The more specific you are, the better the result.</p>

          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={6}
            placeholder="Describe exactly what you need. Include any context, documents, or references that will help."
            className="mt-6 w-full rounded-xl border border-border bg-white px-5 py-4 text-sm text-text placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />
          <p className="mt-1 text-xs text-gray-400">{brief.length} characters (minimum 50)</p>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(1)} className="rounded-lg border border-gray-200 px-5 py-3 text-sm text-text hover:bg-gray-50 transition-colors">Back</button>
            <button onClick={() => { if (brief.trim().length >= 50) { setError(""); setStep(3); } else { setError("Please provide at least 50 characters."); } }} className="flex-1 rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
              Continue to Payment
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 3: Payment ═══ */}
      {step === 3 && (
        <div>
          <h1 className="text-2xl font-bold text-text">Complete your order</h1>

          <div className="mt-6 rounded-xl border border-border-light bg-card p-6 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full">
                {candidate?.profile_photo_url ? (
                  <img src={candidate.profile_photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-background text-sm font-semibold text-text-tertiary">{candidate?.display_name?.[0]}</div>
                )}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-text">{pkg.title}</p>
                <p className="text-xs text-text-muted">by {candidate?.display_name}</p>
              </div>
            </div>

            <p className="text-xs text-text-tertiary">Delivery expected by</p>
            <p className="text-sm font-medium text-text">
              {new Date(Date.now() + (pkg.delivery_days || 3) * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>

            <p className="mt-4 text-4xl font-bold text-text">${price}</p>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-6 flex gap-3">
            <button onClick={() => setStep(2)} className="rounded-lg border border-gray-200 px-5 py-3 text-sm text-text hover:bg-gray-50 transition-colors">Back</button>
            <button onClick={handleCreateOrder} disabled={submitting} className="flex-1 rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
              {submitting ? "Processing..." : "Pay and Start"}
            </button>
          </div>

          <p className="mt-3 text-center text-[11px] text-text-tertiary">
            Your payment is held in escrow until you approve the delivery. You are protected.
          </p>
        </div>
      )}

      {/* ═══ STEP 4: Confirmed ═══ */}
      {step === 4 && (
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-text">Order confirmed</h1>
          <p className="mt-2 text-sm text-text-muted">
            {firstName} has received your brief and your ${price} is held safely in escrow.
            They typically deliver within {pkg.delivery_days} days — your delivery is expected by{" "}
            <strong>{deliveryDueAt}</strong>.
          </p>
          <p className="mt-2 text-xs text-text-tertiary">We&apos;ll notify you the moment your delivery arrives.</p>

          {/* Progress tracker */}
          <div className="mt-8 mx-auto max-w-sm">
            <div className="flex items-center justify-between">
              {["Brief received", "In progress", "Delivered", "Approved"].map((label, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    i === 0 ? "bg-green-100" : i === 1 ? "bg-primary/20" : "bg-gray-100"
                  }`}>
                    {i === 0 ? (
                      <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    ) : i === 1 ? (
                      <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <span className={`text-[9px] ${i <= 1 ? "text-text font-medium" : "text-gray-400"}`}>{label}</span>
                </div>
              ))}
            </div>
            <div className="mt-1 flex items-center px-4">
              <div className="h-0.5 flex-1 bg-green-500" />
              <div className="h-0.5 flex-1 bg-primary/30" />
              <div className="h-0.5 flex-1 bg-gray-200" />
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <Link href="/services" className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
              Go to My Orders
            </Link>
            <Link href="/services" className="text-sm text-text-muted hover:text-text transition-colors">
              Browse more services
            </Link>
          </div>
        </div>
      )}

      {/* ═══ STEP 5: Review (shown after approval) ═══ */}
      {step === 5 && (
        <div className="text-center">
          <h1 className="text-2xl font-bold text-text">How did {firstName} do?</h1>

          <div className="mt-6 flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button key={star} onClick={() => setRating(star)} className="transition-transform hover:scale-110">
                <svg className={`h-10 w-10 ${star <= rating ? "text-amber-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>

          <textarea
            value={reviewBody}
            onChange={(e) => setReviewBody(e.target.value)}
            rows={3}
            placeholder="Optional: Tell others what made this worth it"
            className="mt-4 w-full rounded-xl border border-border bg-white px-5 py-3 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
          />

          <button onClick={handleSubmitReview} disabled={rating < 1 || submitting} className="mt-4 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-40">
            {submitting ? "Submitting..." : "Submit Review"}
          </button>

          <button onClick={() => router.push("/services")} className="mt-3 text-sm text-text-muted hover:text-text">
            Skip for now
          </button>
        </div>
      )}
    </div>
  );
}
