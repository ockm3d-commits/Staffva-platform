"use client";

import { useState } from "react";

interface Lane2Candidate {
  id: string;
  display_name: string;
  full_name: string;
  role_category: string;
  profile_photo_url: string | null;
  screening_score: number | null;
  second_interview_completed_at: string | null;
  admin_status: string;
  tagline: string | null;
  bio: string | null;
  resume_url: string | null;
  payout_method: string | null;
  id_verification_status: string | null;
  voice_recording_1_url: string | null;
  voice_recording_2_url: string | null;
  english_mc_score: number | null;
  recruiter_ai_score_results: { dimension: string; score: number }[] | null;
  video_intro_url?: string | null;
  id_verification_consent: boolean | null;
}

interface Lane2Props {
  candidates: Lane2Candidate[];
  token: string;
  onSubmitForApproval: (candidateId: string) => void;
  onRequestRevision: (candidateId: string, candidateName: string) => void;
}

function getChecklist(c: Lane2Candidate) {
  return [
    { label: "Voice recording 1", auto: true, pass: !!c.voice_recording_1_url },
    { label: "Voice recording 2", auto: true, pass: !!c.voice_recording_2_url },
    { label: "ID verification passed", auto: true, pass: c.id_verification_status === "passed" },
    { label: "Profile photo uploaded", auto: true, pass: !!c.profile_photo_url },
    { label: "Resume uploaded", auto: true, pass: !!c.resume_url },
    { label: "Tagline set", auto: true, pass: !!c.tagline },
    { label: "Bio set", auto: true, pass: !!c.bio },
    { label: "Payout method set", auto: true, pass: !!c.payout_method },
    { label: "Interview consent", auto: true, pass: !!c.id_verification_consent },
    { label: "MC score >= 70%", auto: true, pass: (c.english_mc_score ?? 0) >= 70 },
    // Removed: video_intro not in original 11 conditions per spec, but we can check it
    // The 3 subjective checks below must be manually confirmed by recruiter
  ];
}

const SUBJECTIVE_CHECKS = [
  "Profile photo is professional and clear",
  "Bio is professional and detailed",
  "Tagline is specific and role-relevant",
];

export default function Lane2Profiles({ candidates, token, onSubmitForApproval, onRequestRevision }: Lane2Props) {
  const [manualChecks, setManualChecks] = useState<Map<string, Set<number>>>(new Map());
  const [submitting, setSubmitting] = useState<string | null>(null);

  function toggleManualCheck(candidateId: string, idx: number) {
    const next = new Map(manualChecks);
    const checks = new Set(next.get(candidateId) || []);
    if (checks.has(idx)) checks.delete(idx);
    else checks.add(idx);
    next.set(candidateId, checks);
    setManualChecks(next);
  }

  async function handleSubmit(candidateId: string) {
    setSubmitting(candidateId);
    try {
      const res = await fetch("/api/admin/candidates/review", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ candidateId, action: "pending_speaking_review" }),
      });
      if (res.ok) {
        onSubmitForApproval(candidateId);
      }
    } catch { /* silent */ }
    setSubmitting(null);
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No profiles ready for submission</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {candidates.map((c) => {
        const checklist = getChecklist(c);
        const autoPassCount = checklist.filter((ch) => ch.pass).length;
        const manualSet = manualChecks.get(c.id) || new Set();
        const manualPassCount = manualSet.size;
        const totalPass = autoPassCount + manualPassCount;
        const totalRequired = checklist.length + SUBJECTIVE_CHECKS.length;
        const allGreen = totalPass === totalRequired;

        const daysSince = c.second_interview_completed_at
          ? Math.floor((Date.now() - new Date(c.second_interview_completed_at).getTime()) / (1000 * 60 * 60 * 24))
          : null;

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
                {daysSince != null && (
                  <p className="mt-0.5 text-[11px] text-gray-400">{daysSince}d since interview</p>
                )}

                {/* 11-condition checklist */}
                <div className="mt-3 space-y-1">
                  {checklist.map((ch, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px]">
                      {ch.pass ? (
                        <svg className="h-3.5 w-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                      ) : (
                        <svg className="h-3.5 w-3.5 text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      )}
                      <span className={ch.pass ? "text-gray-600" : "text-red-600 font-medium"}>{ch.label}</span>
                    </div>
                  ))}
                  {SUBJECTIVE_CHECKS.map((label, idx) => (
                    <div key={`sub-${idx}`} className="flex items-center gap-2 text-[11px]">
                      <input
                        type="checkbox"
                        checked={manualSet.has(idx)}
                        onChange={() => toggleManualCheck(c.id, idx)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-green-500 focus:ring-green-500"
                      />
                      <span className={manualSet.has(idx) ? "text-gray-600" : "text-gray-500"}>{label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleSubmit(c.id)}
                    disabled={!allGreen || submitting === c.id}
                    className="rounded-lg bg-[#FE6E3E] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#E55A2B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting === c.id ? "Submitting..." : "Submit for Approval"}
                  </button>
                  <button
                    onClick={() => onRequestRevision(c.id, c.display_name || c.full_name)}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-[#1C1B1A] hover:border-[#FE6E3E] hover:text-[#FE6E3E] transition-colors"
                  >
                    Request Revision
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
