"use client";

import { useState } from "react";

interface Lane1Candidate {
  id: string;
  display_name: string;
  full_name: string;
  role_category: string;
  profile_photo_url: string | null;
  second_interview_scheduled_at: string;
  screening_score: number | null;
  resume_url: string | null;
  recruiter_ai_score_results: { dimension: string; score: number }[] | null;
}

interface Lane1Props {
  candidates: Lane1Candidate[];
  calendarLink: string | null;
}

export default function Lane1Resumes({ candidates, calendarLink }: Lane1Props) {
  const [resumeSheet, setResumeSheet] = useState<{ url: string; name: string } | null>(null);

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No interviews scheduled today</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {candidates.map((c) => {
          const scheduledAt = new Date(c.second_interview_scheduled_at);
          const now = new Date();
          const diffMs = scheduledAt.getTime() - now.getTime();
          const hoursLeft = Math.floor(diffMs / (1000 * 60 * 60));
          const minsLeft = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          const isPast = diffMs < 0;
          const aiScore = c.recruiter_ai_score_results
            ? Math.round(c.recruiter_ai_score_results.reduce((s, d) => s + d.score, 0) / c.recruiter_ai_score_results.length)
            : c.screening_score;

          return (
            <div key={c.id} className="rounded-lg border border-gray-200 bg-white p-4">
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
                    {aiScore != null && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{aiScore}/10</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-gray-500">
                    <span>
                      {scheduledAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })} at{" "}
                      {scheduledAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className={`font-semibold ${isPast ? "text-red-500" : hoursLeft < 1 ? "text-amber-500" : "text-gray-600"}`}>
                      {isPast ? "Past due" : `${hoursLeft}h ${minsLeft}m`}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 flex-wrap">
                    {calendarLink && (
                      <a
                        href={calendarLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg bg-[#FE6E3E] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#E55A2B] transition-colors"
                      >
                        Join Meet
                      </a>
                    )}
                    {c.resume_url && (
                      <button
                        onClick={() => setResumeSheet({ url: c.resume_url!, name: c.display_name || c.full_name })}
                        className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[#1C1B1A] hover:border-[#FE6E3E] hover:text-[#FE6E3E] transition-colors"
                      >
                        View Resume
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Resume slide-up sheet */}
      {resumeSheet && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setResumeSheet(null)}>
          <div
            className="w-full max-w-3xl rounded-t-2xl bg-white shadow-xl"
            style={{ height: "80vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
              <p className="text-sm font-semibold text-[#1C1B1A]">{resumeSheet.name} — Resume</p>
              <button onClick={() => setResumeSheet(null)} className="rounded-lg p-1.5 hover:bg-gray-100">
                <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <iframe
              src={resumeSheet.url}
              className="h-[calc(80vh-52px)] w-full"
              title="Resume"
            />
          </div>
        </div>
      )}
    </>
  );
}
