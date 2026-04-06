"use client";

import { useState } from "react";

interface RevisionItem {
  type: string;
  note?: string;
}

interface Lane3Revision {
  id: string;
  candidate_id: string;
  items: RevisionItem[];
  status: string;
  created_at: string;
  candidates: {
    id: string;
    display_name: string;
    full_name: string;
    role_category: string;
    profile_photo_url: string | null;
  };
}

interface Lane3Props {
  revisions: Lane3Revision[];
  token: string;
  onReminderSent: () => void;
}

export default function Lane3Revisions({ revisions, token, onReminderSent }: Lane3Props) {
  const [sending, setSending] = useState<string | null>(null);
  const [cooldowns, setCooldowns] = useState<Map<string, string>>(new Map());

  async function handleSendReminder(candidateId: string, revisionId: string) {
    setSending(candidateId);
    try {
      const res = await fetch("/api/recruiter/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ candidateId, revisionId }),
      });
      if (res.ok) {
        onReminderSent();
      } else {
        const data = await res.json();
        if (res.status === 429 && data.error) {
          const next = new Map(cooldowns);
          next.set(candidateId, data.error);
          setCooldowns(next);
        }
      }
    } catch { /* silent */ }
    setSending(null);
  }

  if (revisions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No pending revisions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {revisions.map((rev) => {
        const c = rev.candidates;
        const daysSince = Math.floor((Date.now() - new Date(rev.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const cooldownMsg = cooldowns.get(rev.candidate_id);

        return (
          <div key={rev.id} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-100">
                {c.profile_photo_url ? (
                  <img src={c.profile_photo_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-bold text-gray-400">
                    {(c.display_name || c.full_name)?.[0] || "?"}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#1C1B1A] truncate">{c.display_name || c.full_name}</p>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{c.role_category}</span>
                  <span className={`shrink-0 text-[10px] font-semibold ${daysSince > 3 ? "text-red-500" : "text-gray-400"}`}>{daysSince}d ago</span>
                </div>

                {/* Revision items as tags */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rev.items.map((item, idx) => {
                    const shortLabel = item.type.split(" — ").slice(0, 2).join(" — ");
                    return (
                      <span key={idx} className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] text-amber-700">
                        {shortLabel}
                      </span>
                    );
                  })}
                </div>

                <div className="mt-3">
                  {cooldownMsg ? (
                    <p className="text-[11px] text-gray-400">{cooldownMsg}</p>
                  ) : (
                    <button
                      onClick={() => handleSendReminder(rev.candidate_id, rev.id)}
                      disabled={sending === rev.candidate_id}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[#1C1B1A] hover:border-[#FE6E3E] hover:text-[#FE6E3E] transition-colors disabled:opacity-50"
                    >
                      {sending === rev.candidate_id ? "Sending..." : "Send Reminder"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
