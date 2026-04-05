"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const OUTCOME_CATEGORIES = [
  { value: "reviewed", label: "Reviewed", icon: "📋", desc: "Check, audit, or evaluate something" },
  { value: "written", label: "Written", icon: "✍️", desc: "Draft, write, or compose a document" },
  { value: "designed", label: "Designed", icon: "🎨", desc: "Create visuals, layouts, or brand assets" },
  { value: "organized", label: "Organized", icon: "📁", desc: "Sort, structure, or systematize" },
  { value: "built", label: "Built", icon: "🔧", desc: "Build, develop, or configure" },
  { value: "managed", label: "Managed", icon: "📊", desc: "Oversee, coordinate, or run" },
];

const CATEGORY_PROMPTS: Record<string, string> = {
  reviewed: "What will you have checked and what will you flag for the client?",
  written: "What document or content will the client receive?",
  designed: "What visual assets or designs will you deliver?",
  organized: "What will be sorted, structured, or systematized?",
  built: "What system, tool, or product will be created?",
  managed: "What process or project will you oversee and what are the outcomes?",
};

const DELIVERY_OPTIONS = [
  { days: 1, label: "24 hours" },
  { days: 2, label: "2 days" },
  { days: 3, label: "3 days" },
  { days: 5, label: "5 days" },
  { days: 7, label: "7 days" },
  { days: 14, label: "14 days" },
];

const STEP_LABELS = ["What you do", "Deliverables", "Timeline", "Pricing", "Tiers"];

export default function ServiceBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [candidateData, setCandidateData] = useState<Record<string, unknown> | null>(null);

  // Decision 1
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [outcomeCategory, setOutcomeCategory] = useState("");
  const [aiTitle, setAiTitle] = useState("");
  const [refining, setRefining] = useState(false);

  // Decision 2
  const [deliverables, setDeliverables] = useState<string[]>([""]);

  // Decision 3
  const [deliveryDays, setDeliveryDays] = useState(3);
  const [deliveryDistribution, setDeliveryDistribution] = useState<Record<number, number>>({});

  // Decision 4
  const [price, setPrice] = useState(0);
  const [priceRange, setPriceRange] = useState<{ low: number; high: number } | null>(null);

  // Decision 5
  const [useTiers, setUseTiers] = useState(false);
  const [tier2Label, setTier2Label] = useState("");
  const [tier2Price, setTier2Price] = useState(0);
  const [tier2Deliverables, setTier2Deliverables] = useState<string[]>([""]);
  const [tier3Label, setTier3Label] = useState("");
  const [tier3Price, setTier3Price] = useState(0);
  const [tier3Deliverables, setTier3Deliverables] = useState<string[]>([""]);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data: c } = await supabase.from("candidates").select("id, display_name, profile_photo_url, role_category, reputation_tier, english_written_tier, speaking_level").eq("user_id", user.id).single();
      if (c) { setCandidateId(c.id); setCandidateData(c); }
    }
    load();
  }, [router]);

  // Load market context when category or step changes
  useEffect(() => {
    if (outcomeCategory && (step === 3 || step === 4)) {
      loadMarketContext();
    }
  }, [outcomeCategory, step]);

  async function loadMarketContext() {
    const tier = (candidateData?.reputation_tier as string) || "";
    const res = await fetch(`/api/services/market-context?category=${outcomeCategory}&tier=${encodeURIComponent(tier)}`);
    const data = await res.json();
    setDeliveryDistribution(data.deliveryDistribution || {});
    setPriceRange(data.priceRange || null);
  }

  async function handleRefineTitle() {
    if (!description.trim()) return;
    setRefining(true);
    try {
      const res = await fetch("/api/services/refine-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim() }),
      });
      const data = await res.json();
      if (data.title) setAiTitle(data.title);
    } catch { /* silent */ }
    setRefining(false);
  }

  function canProceed(): boolean {
    switch (step) {
      case 1: return !!title.trim() && !!outcomeCategory;
      case 2: return deliverables.filter((d) => d.trim()).length >= 2;
      case 3: return deliveryDays > 0;
      case 4: return price >= 5;
      case 5: return true;
      default: return false;
    }
  }

  async function handleSave(status: "draft" | "pending_review") {
    setSaving(true);
    setError("");

    const supabase = createClient();
    const validDeliverables = deliverables.filter((d) => d.trim());

    const packageData: Record<string, unknown> = {
      candidate_id: candidateId,
      title: title.trim(),
      description: description.trim(),
      whats_included: validDeliverables,
      delivery_days: deliveryDays,
      price_usd: price,
      outcome_category: outcomeCategory,
      category: outcomeCategory,
      tier: "basic",
      status,
    };

    if (useTiers) {
      packageData.tier_1_label = "Standard";
      packageData.tier_1_price = price;
      packageData.tier_1_deliverables = validDeliverables;
      if (tier2Label.trim() && tier2Price > 0) {
        packageData.tier_2_label = tier2Label.trim();
        packageData.tier_2_price = tier2Price;
        packageData.tier_2_deliverables = tier2Deliverables.filter((d) => d.trim());
      }
      if (tier3Label.trim() && tier3Price > 0) {
        packageData.tier_3_label = tier3Label.trim();
        packageData.tier_3_price = tier3Price;
        packageData.tier_3_deliverables = tier3Deliverables.filter((d) => d.trim());
      }
    }

    const res = await fetch("/api/services/packages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packageData),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    router.push("/services");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-border-light">
        <div className="mx-auto max-w-2xl px-6 py-3">
          <div className="flex items-center justify-between mb-2">
            {STEP_LABELS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  i + 1 < step ? "bg-primary text-white" : i + 1 === step ? "bg-primary/20 text-primary border-2 border-primary" : "bg-gray-100 text-gray-400"
                }`}>
                  {i + 1 < step ? "✓" : i + 1}
                </div>
                <span className={`text-[10px] hidden sm:inline ${i + 1 <= step ? "text-text font-medium" : "text-gray-400"}`}>{label}</span>
              </div>
            ))}
          </div>
          <div className="h-1 w-full rounded-full bg-gray-100">
            <div className="h-1 rounded-full bg-primary transition-all" style={{ width: `${(step / 6) * 100}%` }} />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 py-10">
        {/* ═══ STEP 1: What do you do? ═══ */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-text">What do you do for clients?</h1>
            <p className="mt-1 text-sm text-text-muted">Describe your service in your own words. We&apos;ll help you refine it.</p>

            <div className="mt-6">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="Describe the service you offer in your own words."
                className="w-full rounded-xl border border-border bg-white px-5 py-4 text-sm text-text placeholder-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />

              <button
                onClick={handleRefineTitle}
                disabled={refining || !description.trim()}
                className="mt-2 flex items-center gap-1.5 rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                {refining ? (
                  <><div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Refining...</>
                ) : (
                  <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" /></svg> AI Refine</>
                )}
              </button>

              {aiTitle && (
                <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-text-muted mb-1">AI suggestion:</p>
                  <p className="text-sm font-medium text-text">{aiTitle}</p>
                  <button onClick={() => { setTitle(aiTitle); setAiTitle(""); }} className="mt-2 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white hover:bg-primary-dark transition-colors">
                    Use this title
                  </button>
                </div>
              )}

              <div className="mt-4">
                <label className="block text-sm font-medium text-text">Service Title <span className="text-red-500">*</span></label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. Complete Contract Review and Risk Assessment"
                  className="mt-1 w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                />
                <p className="mt-1 text-xs text-gray-400">{title.length}/80</p>
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-text mb-3">What category? <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {OUTCOME_CATEGORIES.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setOutcomeCategory(cat.value)}
                    className={`rounded-xl border-2 p-3 text-left transition-colors ${
                      outcomeCategory === cat.value ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-xl">{cat.icon}</span>
                    <p className="text-sm font-semibold text-text mt-1">{cat.label}</p>
                    <p className="text-[10px] text-text-muted">{cat.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ═══ STEP 2: Deliverables ═══ */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-text">What exactly will the client receive?</h1>
            <p className="mt-1 text-sm text-text-muted">{CATEGORY_PROMPTS[outcomeCategory] || "List the key outcomes the client will receive."}</p>

            <div className="mt-6 space-y-3">
              {deliverables.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <input
                    value={d}
                    onChange={(e) => { const n = [...deliverables]; n[i] = e.target.value; setDeliverables(n); }}
                    placeholder={`Deliverable ${i + 1}`}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                  {deliverables.length > 1 && (
                    <button onClick={() => setDeliverables(deliverables.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500 transition-colors">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {deliverables.length < 8 && (
              <button onClick={() => setDeliverables([...deliverables, ""])} className="mt-3 text-sm text-primary hover:text-primary-dark font-medium">
                + Add deliverable
              </button>
            )}
            <p className="mt-2 text-xs text-gray-400">Minimum 2, maximum 8. {deliverables.filter((d) => d.trim()).length}/8 added.</p>
          </div>
        )}

        {/* ═══ STEP 3: Timeline ═══ */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-text">How long will it take?</h1>
            <p className="mt-1 text-sm text-text-muted">Set your delivery time. Clients see this before purchasing.</p>

            <div className="mt-6 space-y-2">
              {DELIVERY_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setDeliveryDays(opt.days)}
                  className={`w-full flex items-center justify-between rounded-xl border-2 px-5 py-4 transition-colors ${
                    deliveryDays === opt.days ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <span className="text-sm font-medium text-text">{opt.label}</span>
                  {deliveryDistribution[opt.days] !== undefined && deliveryDistribution[opt.days] > 0 && (
                    <span className="text-xs text-text-tertiary">{deliveryDistribution[opt.days]}% of professionals</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ STEP 4: Pricing ═══ */}
        {step === 4 && (
          <div>
            <h1 className="text-2xl font-bold text-text">What do you charge?</h1>
            <p className="mt-1 text-sm text-text-muted">Set your base price. You can add tiers in the next step.</p>

            <div className="mt-6">
              <label className="block text-sm font-medium text-text">Base Price (USD) <span className="text-red-500">*</span></label>
              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">$</span>
                <input
                  type="number"
                  min={5}
                  value={price || ""}
                  onChange={(e) => setPrice(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-gray-300 pl-8 pr-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="50"
                />
              </div>

              {priceRange && (
                <div className="mt-4 rounded-xl border border-border-light bg-gray-50 p-4">
                  <p className="text-sm text-text">
                    Verified professionals in your category typically earn between{" "}
                    <span className="font-semibold text-primary">${priceRange.low}</span> and{" "}
                    <span className="font-semibold text-primary">${priceRange.high}</span> per service.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ STEP 5: Tiers ═══ */}
        {step === 5 && (
          <div>
            <h1 className="text-2xl font-bold text-text">Do you want to offer tiers?</h1>
            <p className="mt-1 text-sm text-text-muted">Tiers let you offer different levels of service at different price points.</p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setUseTiers(false)}
                className={`flex-1 rounded-xl border-2 p-4 text-center transition-colors ${!useTiers ? "border-primary bg-primary/5" : "border-gray-200"}`}
              >
                <p className="text-sm font-semibold text-text">No, single package</p>
                <p className="text-xs text-text-muted mt-1">Keep it simple</p>
              </button>
              <button
                onClick={() => setUseTiers(true)}
                className={`flex-1 rounded-xl border-2 p-4 text-center transition-colors ${useTiers ? "border-primary bg-primary/5" : "border-gray-200"}`}
              >
                <p className="text-sm font-semibold text-text">Yes, add tiers</p>
                <p className="text-xs text-text-muted mt-1">Good, Better, Best</p>
              </button>
            </div>

            {useTiers && (
              <div className="mt-6 space-y-6">
                {/* Tier 1 summary */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Tier 1 — Base</p>
                  <p className="text-sm font-medium text-text mt-1">{title}</p>
                  <p className="text-sm text-primary font-semibold">${price}</p>
                </div>

                {/* Tier 2 */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Tier 2 — Enhanced</p>
                  <input value={tier2Label} onChange={(e) => setTier2Label(e.target.value)} placeholder="e.g. Full Review" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                    <input type="number" min={price + 1} value={tier2Price || ""} onChange={(e) => setTier2Price(parseInt(e.target.value) || 0)} placeholder="Price" className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">Additional deliverables (on top of base):</p>
                  {tier2Deliverables.map((d, i) => (
                    <input key={i} value={d} onChange={(e) => { const n = [...tier2Deliverables]; n[i] = e.target.value; setTier2Deliverables(n); }} placeholder={`Additional item ${i + 1}`} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
                  ))}
                  {tier2Deliverables.length < 4 && (
                    <button onClick={() => setTier2Deliverables([...tier2Deliverables, ""])} className="mt-1 text-xs text-primary hover:underline">+ Add</button>
                  )}
                </div>

                {/* Tier 3 */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">Tier 3 — Premium</p>
                  <input value={tier3Label} onChange={(e) => setTier3Label(e.target.value)} placeholder="e.g. Comprehensive Package" className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
                  <div className="relative mt-2">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-sm">$</span>
                    <input type="number" min={tier2Price + 1} value={tier3Price || ""} onChange={(e) => setTier3Price(parseInt(e.target.value) || 0)} placeholder="Price" className="w-full rounded-lg border border-gray-300 pl-7 pr-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
                  </div>
                  <p className="mt-2 text-xs text-text-muted">Additional deliverables (on top of Tier 2):</p>
                  {tier3Deliverables.map((d, i) => (
                    <input key={i} value={d} onChange={(e) => { const n = [...tier3Deliverables]; n[i] = e.target.value; setTier3Deliverables(n); }} placeholder={`Additional item ${i + 1}`} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary" />
                  ))}
                  {tier3Deliverables.length < 4 && (
                    <button onClick={() => setTier3Deliverables([...tier3Deliverables, ""])} className="mt-1 text-xs text-primary hover:underline">+ Add</button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ STEP 6: Preview ═══ */}
        {step === 6 && (
          <div>
            <h1 className="text-2xl font-bold text-text">Preview your service</h1>
            <p className="mt-1 text-sm text-text-muted">This is how clients will see your service listing.</p>

            <div className="mt-6 rounded-2xl border border-border-light bg-card overflow-hidden">
              {/* Professional header */}
              <div className="bg-[#1C1B1A] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/20">
                    {candidateData?.profile_photo_url ? (
                      <img src={candidateData.profile_photo_url as string} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-white/60">
                        {(candidateData?.display_name as string)?.[0] || "?"}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-white">{candidateData?.display_name as string || "You"}</p>
                      {typeof candidateData?.reputation_tier === "string" && candidateData.reputation_tier && (
                        <span className={`rounded-full px-1.5 py-0.5 text-[8px] font-bold ${
                          candidateData.reputation_tier === "Elite" ? "bg-amber-700 text-amber-100" : "bg-primary text-white"
                        }`}>{candidateData.reputation_tier}</span>
                      )}
                    </div>
                    <p className="text-xs text-white/50">{candidateData?.role_category as string}</p>
                  </div>
                </div>
              </div>

              {/* Service details */}
              <div className="px-5 py-5">
                <h2 className="text-lg font-semibold text-text">{title || "Your service title"}</h2>
                <span className="mt-1.5 inline-block rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  Delivers in {deliveryDays} day{deliveryDays !== 1 ? "s" : ""}
                </span>

                <ul className="mt-3 space-y-1.5">
                  {deliverables.filter((d) => d.trim()).map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-text-muted">
                      <svg className="h-4 w-4 mt-0.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      {d}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Price */}
              <div className="border-t border-border-light bg-gray-50 px-5 py-4 flex items-center justify-between">
                <p className="text-xl font-bold text-text">${price}</p>
                <span className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white">Buy Now</span>
              </div>
            </div>

            {/* Tier preview */}
            {useTiers && tier2Label && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase">Standard</p>
                  <p className="text-lg font-bold text-text mt-1">${price}</p>
                  <p className="text-xs text-text-muted mt-1">{deliverables.filter((d) => d.trim()).length} deliverables</p>
                </div>
                <div className="rounded-xl border-2 border-primary p-4">
                  <p className="text-xs font-semibold text-primary uppercase">{tier2Label}</p>
                  <p className="text-lg font-bold text-text mt-1">${tier2Price}</p>
                  <p className="text-xs text-text-muted mt-1">+ {tier2Deliverables.filter((d) => d.trim()).length} extras</p>
                </div>
                {tier3Label && (
                  <div className="rounded-xl border border-gray-200 p-4">
                    <p className="text-xs font-semibold text-text-muted uppercase">{tier3Label}</p>
                    <p className="text-lg font-bold text-text mt-1">${tier3Price}</p>
                    <p className="text-xs text-text-muted mt-1">+ {tier3Deliverables.filter((d) => d.trim()).length} extras</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <div>
            {step > 1 && (
              <button onClick={() => setStep(step - 1)} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-text hover:bg-gray-50 transition-colors">
                Back
              </button>
            )}
          </div>

          <div className="flex gap-3">
            {step < 6 && (
              <button onClick={() => handleSave("draft")} disabled={saving} className="text-sm text-text-muted hover:text-text transition-colors disabled:opacity-50">
                Save as Draft
              </button>
            )}

            {step < 5 && (
              <button onClick={() => setStep(step + 1)} disabled={!canProceed()} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-40">
                Continue
              </button>
            )}

            {step === 5 && (
              <button onClick={() => setStep(6)} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
                Preview
              </button>
            )}

            {step === 6 && (
              <div className="flex gap-3">
                <button onClick={() => handleSave("draft")} disabled={saving} className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-text hover:bg-gray-50 transition-colors disabled:opacity-50">
                  {saving ? "Saving..." : "Save as Draft"}
                </button>
                <button onClick={() => handleSave("pending_review")} disabled={saving} className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {saving ? "Publishing..." : "Publish Service"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
