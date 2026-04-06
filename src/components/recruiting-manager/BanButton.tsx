"use client";

import { useState } from "react";

interface BanButtonProps {
  candidateId: string;
  candidateName: string;
  alreadyBanPending: boolean;
}

export default function BanButton({
  candidateId,
  candidateName,
  alreadyBanPending,
}: BanButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(alreadyBanPending);
  const [error, setError] = useState<string | null>(null);

  const reasonTrimmed = reason.trim();
  const canSubmit = reasonTrimmed.length >= 20 && !loading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/recruiting-manager/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, reason: reasonTrimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Request failed");
      } else {
        setSubmitted(true);
        setShowModal(false);
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-100 px-4 py-2 text-sm font-semibold text-orange-700 cursor-not-allowed">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        Ban Pending Review
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Ban Candidate
      </button>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !loading && setShowModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-[#1C1B1A]">Ban Candidate</h2>
            <p className="mt-1 text-sm text-gray-500">
              Flag <strong>{candidateName}</strong> for deactivation. Ahmed will review before any action is taken.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-[#1C1B1A]">
                Reason <span className="text-gray-400 font-normal">(minimum 20 characters)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                placeholder="Describe why this candidate should be deactivated..."
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-red-400 focus:outline-none focus:ring-1 focus:ring-red-400 resize-none"
              />
              <p className={`mt-1 text-xs ${reasonTrimmed.length < 20 ? "text-gray-400" : "text-green-600"}`}>
                {reasonTrimmed.length} / 20 characters minimum
              </p>
            </div>

            {error && (
              <p className="mt-2 text-xs text-red-600">{error}</p>
            )}

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Submitting..." : "Submit Ban Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
