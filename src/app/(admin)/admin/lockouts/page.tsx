"use client";

import { useState, useEffect } from "react";

interface LockoutEntry {
  id: string;
  identity_hash: string;
  candidate_id: string;
  failed_at: string;
  lockout_expires_at: string;
  attempt_number: number;
  is_active: boolean;
  days_remaining: number;
  candidate: {
    display_name: string;
    full_name: string;
    email: string;
    country: string;
    role_category: string;
    permanently_blocked: boolean;
  } | null;
}

export default function AdminLockoutsPage() {
  const [lockouts, setLockouts] = useState<LockoutEntry[]>([]);
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverride, setShowOverride] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/lockouts");
      if (res.ok) {
        const data = await res.json();
        setLockouts(data.lockouts || []);
        setActive(data.active || 0);
        setTotal(data.total || 0);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  async function handleOverride(lockoutId: string) {
    if (!overrideReason.trim()) return;
    setOverriding(lockoutId);

    await fetch("/api/admin/lockouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lockoutId, reason: overrideReason.trim() }),
    });

    setShowOverride(null);
    setOverrideReason("");
    setOverriding(null);
    await loadData();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FE6E3E] border-t-transparent" /></div>;
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1C1B1A]">English Test Lockouts</h1>
      <p className="mt-1 text-sm text-gray-500">Identity-based lockout management and override</p>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-2xl font-bold text-red-700">{active}</p>
          <p className="text-xs text-red-600 mt-1">Active Lockouts</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-[#1C1B1A]">{total}</p>
          <p className="text-xs text-gray-500 mt-1">Total Records</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-400">{total - active}</p>
          <p className="text-xs text-gray-500 mt-1">Expired</p>
        </div>
      </div>

      {lockouts.length === 0 ? (
        <div className="mt-8 rounded-lg border border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No lockout records found.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {lockouts.map((l) => (
            <div key={l.id} className={`rounded-lg border p-4 ${l.is_active ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"}`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`h-2.5 w-2.5 rounded-full ${l.is_active ? "bg-red-500" : "bg-gray-300"}`} />
                  <div>
                    <p className="text-sm font-medium text-[#1C1B1A]">
                      {l.candidate?.display_name || l.candidate?.full_name || "Unknown"}
                    </p>
                    <p className="text-[10px] text-gray-500">
                      {l.candidate?.email} · {l.candidate?.country} · {l.candidate?.role_category}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  <div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      l.attempt_number >= 5 ? "bg-red-100 text-red-700" :
                      l.attempt_number >= 3 ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      Attempt {l.attempt_number}/5
                    </span>
                  </div>
                  {l.candidate?.permanently_blocked && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">Permanent</span>
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                <span>Failed: {new Date(l.failed_at).toLocaleDateString()}</span>
                <span>Expires: {new Date(l.lockout_expires_at).toLocaleDateString()}</span>
                {l.is_active && <span className="font-medium text-red-600">{l.days_remaining} days remaining</span>}
                {!l.is_active && <span className="text-green-600">Expired</span>}
              </div>

              <div className="mt-2 text-[9px] text-gray-400 font-mono truncate">Hash: {l.identity_hash.slice(0, 24)}...</div>

              {l.is_active && (
                <div className="mt-3">
                  {showOverride === l.id ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        placeholder="Reason for override..."
                        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs focus:border-[#FE6E3E] focus:outline-none"
                      />
                      <button
                        onClick={() => handleOverride(l.id)}
                        disabled={!overrideReason.trim() || overriding === l.id}
                        className="rounded-lg bg-[#FE6E3E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#E55A2B] disabled:opacity-50"
                      >
                        {overriding === l.id ? "..." : "Override"}
                      </button>
                      <button onClick={() => { setShowOverride(null); setOverrideReason(""); }} className="text-xs text-gray-500">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowOverride(l.id)}
                      className="text-xs font-medium text-[#FE6E3E] hover:underline"
                    >
                      Override lockout
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
