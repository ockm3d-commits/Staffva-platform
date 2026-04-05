"use client";

import { useState, useEffect } from "react";

interface PendingService {
  id: string;
  title: string;
  description: string;
  whats_included: string[];
  delivery_days: number;
  price_usd: number;
  outcome_category: string;
  status: string;
  created_at: string;
  candidates: {
    display_name: string;
    role_category: string;
    reputation_tier: string | null;
  } | null;
}

export default function ServiceReviewsPage() {
  const [services, setServices] = useState<PendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  useEffect(() => { loadPending(); }, []);

  async function loadPending() {
    try {
      const res = await fetch("/api/services/packages?status=pending_review");
      const data = await res.json();
      setServices(data.packages || []);
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleAction(serviceId: string, action: "approve" | "reject", note?: string) {
    setActionLoading(serviceId);
    try {
      await fetch("/api/services/packages", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: serviceId, status: action === "approve" ? "active" : "rejected", adminNote: note }),
      });
      setRejectModal(null);
      setRejectNote("");
      await loadPending();
    } catch { /* silent */ }
    setActionLoading(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FE6E3E] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-bold text-[#1C1B1A]">Service Reviews</h1>
      <p className="mt-1 text-sm text-gray-500">{services.length} pending review{services.length !== 1 ? "s" : ""}</p>

      {services.length === 0 ? (
        <div className="mt-12 text-center">
          <p className="text-gray-500">All services have been reviewed.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {services.map((s) => {
            const candidate = s.candidates as PendingService["candidates"];
            return (
              <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1B1A]">{s.title}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {candidate?.display_name} &middot; {candidate?.role_category}
                      {candidate?.reputation_tier && <span className="ml-1 text-[#FE6E3E]">&middot; {candidate.reputation_tier}</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">${Number(s.price_usd).toLocaleString()} &middot; {s.delivery_days} day delivery &middot; {s.outcome_category}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleAction(s.id, "approve")}
                      disabled={actionLoading === s.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => { setRejectModal(s.id); setRejectNote(""); }}
                      disabled={actionLoading === s.id}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {s.description && <p className="mt-2 text-xs text-gray-600">{s.description}</p>}

                {s.whats_included && s.whats_included.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {s.whats_included.map((item, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                        <svg className="h-3 w-3 mt-0.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-[#1C1B1A]">Reject Service</h2>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => { setRejectModal(null); setRejectNote(""); }} className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => handleAction(rejectModal, "reject", rejectNote)}
                disabled={!rejectNote.trim() || actionLoading === rejectModal}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
