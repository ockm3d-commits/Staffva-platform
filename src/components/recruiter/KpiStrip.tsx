"use client";

import { useState } from "react";

interface SocialPost {
  id: string;
  post_url: string;
  created_at: string;
}

interface KpiData {
  interviewsToday: number;
  dailyTarget: number;
  recruiterType: string;
  socialPosts: SocialPost[];
  calendarLink: string | null;
  calendarValid: boolean | null;
}

interface KpiStripProps {
  kpi: KpiData;
  token: string;
  onCalendarSaved: (link: string) => void;
  onPostLogged: () => void;
}

export default function KpiStrip({ kpi, token, onCalendarSaved, onPostLogged }: KpiStripProps) {
  const [postModal, setPostModal] = useState(false);
  const [postUrl, setPostUrl] = useState("");
  const [postSaving, setPostSaving] = useState(false);
  const [calendarEdit, setCalendarEdit] = useState(false);
  const [calendarInput, setCalendarInput] = useState(kpi.calendarLink || "");
  const [calendarSaving, setCalendarSaving] = useState(false);
  const [calendarValidState, setCalendarValidState] = useState(kpi.calendarValid);

  // Interview progress
  const dailyTarget = typeof kpi.dailyTarget === "number" && kpi.dailyTarget > 0 ? kpi.dailyTarget : 14;
  const progress = dailyTarget > 0 ? kpi.interviewsToday / dailyTarget : 0;
  const now = new Date();
  const hoursIntoDay = now.getHours() + now.getMinutes() / 60;
  const expectedPace = hoursIntoDay / 10; // ~10 working hours
  const paceRatio = expectedPace > 0 ? progress / expectedPace : progress;
  const progressColor = paceRatio >= 0.8 ? "#22c55e" : paceRatio >= 0.5 ? "#f59e0b" : "#ef4444";

  const circumference = 2 * Math.PI * 36;
  const strokeDash = circumference * Math.min(progress, 1);

  // Social posts
  const postCount = kpi.socialPosts.length;

  async function handleSavePost() {
    if (!postUrl.trim()) return;
    setPostSaving(true);
    try {
      const res = await fetch("/api/recruiter/social-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ postUrl: postUrl.trim() }),
      });
      if (res.ok) {
        setPostUrl("");
        setPostModal(false);
        onPostLogged();
      }
    } catch { /* silent */ }
    setPostSaving(false);
  }

  async function handleSaveCalendar() {
    setCalendarSaving(true);
    try {
      const res = await fetch("/api/recruiter/queue", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      // Use supabase directly via the parent — simplified: just save via API
      // For now, fire to a dedicated endpoint or handle inline
      onCalendarSaved(calendarInput.trim());

      // Async validation
      if (calendarInput.trim()) {
        try {
          const headRes = await fetch(calendarInput.trim(), { method: "HEAD", mode: "no-cors" });
          setCalendarValidState(true);
        } catch {
          setCalendarValidState(false);
        }
      } else {
        setCalendarValidState(null);
      }
    } catch { /* silent */ }
    setCalendarSaving(false);
    setCalendarEdit(false);
  }

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3">
      <div className="mx-auto max-w-7xl flex items-center gap-6 flex-wrap">
        {/* Interview Progress */}
        <div className="flex items-center gap-3">
          <div className="relative h-20 w-20">
            <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
              <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="36" fill="none"
                stroke={progressColor} strokeWidth="6"
                strokeDasharray={`${strokeDash} ${circumference}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-[#1C1B1A]">{kpi.interviewsToday}</span>
              <span className="text-[9px] text-gray-400">/{dailyTarget}</span>
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#1C1B1A]">Interviews</p>
            <p className="text-[10px] text-gray-400">today</p>
          </div>
        </div>

        {/* Social Posts Pills */}
        <div className="flex items-center gap-2">
          {[0, 1].map((idx) => {
            const posted = idx < postCount;
            return (
              <button
                key={idx}
                onClick={() => !posted && postCount < 2 && setPostModal(true)}
                disabled={posted || postCount >= 2}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                  posted
                    ? "bg-[#FE6E3E] text-white cursor-default"
                    : "border border-[#FE6E3E] text-[#FE6E3E] hover:bg-orange-50"
                }`}
              >
                {posted ? (
                  <span className="flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    Post {idx + 1}
                  </span>
                ) : (
                  `Post ${idx + 1}`
                )}
              </button>
            );
          })}
        </div>

        {/* Calendar Link */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCalendarEdit(!calendarEdit)}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-[#1C1B1A]"
          >
            <span className={`h-3 w-3 rounded-full ${
              kpi.calendarLink && calendarValidState !== false ? "bg-green-500" : "bg-red-500"
            }`} />
            Calendar
          </button>
        </div>
      </div>

      {/* Calendar inline edit */}
      {calendarEdit && (
        <div className="mx-auto max-w-7xl mt-2 flex gap-2">
          <input
            type="url"
            value={calendarInput}
            onChange={(e) => setCalendarInput(e.target.value)}
            placeholder="https://calendar.google.com/calendar/appointments/..."
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
          />
          <button
            onClick={handleSaveCalendar}
            disabled={calendarSaving}
            className="rounded-lg bg-[#FE6E3E] px-4 py-2 text-sm font-semibold text-white hover:bg-[#E55A2B] disabled:opacity-50"
          >
            {calendarSaving ? "Saving..." : "Save"}
          </button>
        </div>
      )}

      {/* Social post modal */}
      {postModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setPostModal(false)}>
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-[#1C1B1A]">Log Social Post</h3>
            <p className="mt-1 text-sm text-gray-500">Paste the URL of your published social post.</p>
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder="https://..."
              className="mt-3 w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:border-[#FE6E3E] focus:outline-none focus:ring-1 focus:ring-[#FE6E3E]"
              autoFocus
            />
            <div className="mt-4 flex gap-3">
              <button onClick={() => setPostModal(false)} className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-[#1C1B1A] hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleSavePost}
                disabled={postSaving || !postUrl.trim()}
                className="flex-1 rounded-lg bg-[#FE6E3E] py-2.5 text-sm font-semibold text-white hover:bg-[#E55A2B] disabled:opacity-50"
              >
                {postSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
