"use client";

import { useState, useEffect } from "react";

export default function PlatformSettingsPage() {
  const [cheatThreshold, setCheatThreshold] = useState(3);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.settings?.cheat_flag_threshold !== undefined) {
            setCheatThreshold(data.settings.cheat_flag_threshold);
          }
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    loadSettings();
  }, []);

  async function saveCheatThreshold() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cheat_flag_threshold: cheatThreshold }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch { /* silent */ }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FE6E3E] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1C1B1A]">Platform Settings</h1>

      {/* Fee Model */}
      <div className="mt-8 max-w-lg rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Fee Model</h2>
        <p className="mt-2 text-sm text-gray-600">
          The platform operates with a fixed <strong>10% fee</strong> on all engagements and service orders.
          The fee is charged to the client on top of the candidate&apos;s rate. Candidates receive 100% of their listed rate.
        </p>
        <div className="mt-3 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
          <p className="text-xs font-medium text-green-700">Active — 10% platform fee on all transactions</p>
        </div>
      </div>

      {/* Anti-Cheat Threshold */}
      <div className="mt-6 max-w-lg rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Anti-Cheat Settings</h2>
        <p className="mt-2 text-sm text-gray-600">
          Candidates with cheat flag events at or above this threshold will show a red <strong>High Flag Count</strong> warning badge
          in the admin review queue. Events include tab switches, mouse leaving the window, paste attempts, and fullscreen exits during the English test.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <label htmlFor="cheatThreshold" className="text-sm font-medium text-[#1C1B1A]">
            Flag threshold:
          </label>
          <input
            id="cheatThreshold"
            type="number"
            min={1}
            max={20}
            value={cheatThreshold}
            onChange={(e) => setCheatThreshold(parseInt(e.target.value) || 1)}
            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-[#1C1B1A] text-center focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
          />
          <span className="text-sm text-gray-500">events</span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={saveCheatThreshold}
            disabled={saving}
            className="rounded-lg bg-[#FE6E3E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Threshold"}
          </button>
          {saved && (
            <span className="text-sm font-medium text-green-600">✓ Saved</span>
          )}
        </div>

        <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <p className="text-xs text-gray-500">
            Current threshold: <strong>{cheatThreshold}</strong> — candidates with {cheatThreshold}+ cheat events will be flagged.
          </p>
        </div>
      </div>

      {/* Recruiter Assignment */}
      <div className="mt-6 max-w-lg rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recruiter Assignment</h2>
        <p className="mt-2 text-sm text-gray-600">
          New candidates are automatically assigned to recruiters using round-robin alternation.
          Assignments can be manually overridden from the All Candidates table.
        </p>
        <div className="mt-3 flex gap-2">
          <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700">Shelly</span>
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Jerome</span>
        </div>
      </div>
    </div>
  );
}
