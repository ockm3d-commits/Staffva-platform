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
  english_comprehension_score: number | null;
  speaking_level: string | null;
  interview_consent_at: string | null;
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

const SPEAKING_LEVELS = [
  { value: "basic", label: "Basic" },
  { value: "conversational", label: "Conversational" },
  { value: "proficient", label: "Proficient" },
  { value: "fluent", label: "Fluent" },
];

function getChecklist(c: Lane2Candidate, selectedSpeaking: string | null) {
  const effectiveSpeaking = c.speaking_level || selectedSpeaking;
  return [
    { label: "Voice recording 1", pass: !!c.voice_recording_1_url },
    { label: "Voice recording 2", pass: !!c.voice_recording_2_url },
    { label: "ID verification passed", pass: c.id_verification_status === "passed" },
    { label: "Profile photo uploaded", pass: !!c.profile_photo_url },
    { label: "Resume uploaded", pass: !!c.resume_url },
    { label: "Tagline set", pass: !!c.tagline },
    { label: "Bio set", pass: !!c.bio },
    { label: "Payout method set", pass: !!c.payout_method },
    { label: "Interview consent", pass: !!c.interview_consent_at },
    { label: "MC score >= 70%", pass: (c.english_mc_score ?? 0) >= 70 },
    { label: "Comprehension >= 70%", pass: (c.english_comprehension_score ?? 0) >= 70 },
    { label: "Speaking level assigned", pass: !!effectiveSpeaking },
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
  const [selectedSpeaking, setSelectedSpeaking] = useState<Map<string, string>>(new Map());
  const [approvalErrors, setApprovalErrors] = useState<Map<string, string[]>>(new Map());
  const [successToast, setSuccessToast] = useState<string | null>(null);

  function toggleManualCheck(candidateId: string, idx: number) {
    const next = new Map(manualChecks);
    const checks = new Set(next.get(candidateId) || []);
    if (checks.has(idx)) checks.delete(idx);
    else checks.add(idx);
    next.set(candidateId, checks);
    setManualChecks(next);
  }

  function handleSpeakingChange(candidateId: string, value: string) {
    const next = new Map(selectedSpeaking);
    next.set(candidateId, value);
    setSelectedSpeaking(next);
    // Clear any previous errors
    const errNext = new Map(approvalErrors);
    errNext.delete(candidateId);
    setApprovalErrors(errNext);
  }

  async function handlePushLive(candidateId: string, existingSpeakingLevel: string | null) {
    setSubmitting(candidateId);
    setApprovalErrors((prev) => { const n = new Map(prev); n.delete(candidateId); return n; });

    try {
      const speakingLevel = existingSpeakingLevel || selectedSpeaking.get(candidateId) || null;

      const res = await fetch("/api/recruiter/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ candidateId, speakingLevel }),
      });

      if (res.ok) {
        onSubmitForApproval(candidateId);
        setSuccessToast(candidateId);
        setTimeout(() => setSuccessToast(null), 3000);
      } else {
        const data = await res.json();
        if (data.failingConditions) {
          setApprovalErrors((prev) => new Map(prev).set(candidateId, data.failingConditions));
        } else if (data.error) {
          setApprovalErrors((prev) => new Map(prev).set(candidateId, [data.error]));
        }
      }
    } catch {
      setApprovalErrors((prev) => new Map(prev).set(candidateId, ["Network error — try again"]));
    }
    setSubmitting(null);
  }

  if (candidates.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No profiles ready for review</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {successToast && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-800">
          Profile is now live.
        </div>
      )}
      {candidates.map((c) => {
        const speakingSelection = selectedSpeaking.get(c.id) || null;
        const checklist = getChecklist(c, speakingSelection);
        const autoPassCount = checklist.filter((ch) => ch.pass).length;
        const manualSet = manualChecks.get(c.id) || new Set();
        const manualPassCount = manualSet.size;
        const totalPass = autoPassCount + manualPassCount;
        const totalRequired = checklist.length + SUBJECTIVE_CHECKS.length;
        const allGreen = totalPass === totalRequired;
        const errors = approvalErrors.get(c.id);

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

                {/* Speaking level dropdown — show when not yet assigned */}
                {!c.speaking_level && (
                  <div className="mt-2">
                    <label className="block text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Speaking Level</label>
                    <select
                      value={speakingSelection || ""}
                      onChange={(e) => handleSpeakingChange(c.id, e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-[#1C1B1A] focus:border-[#FE6E3E] focus:ring-1 focus:ring-[#FE6E3E] outline-none"
                    >
                      <option value="">Select speaking level...</option>
                      {SPEAKING_LEVELS.map((l) => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                {c.speaking_level && (
                  <p className="mt-1.5 text-[11px] text-gray-500">
                    Speaking: <span className="font-medium text-[#1C1B1A] capitalize">{c.speaking_level}</span>
                  </p>
                )}

                {/* Checklist */}
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

                {/* Approval errors */}
                {errors && errors.length > 0 && (
                  <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-2">
                    {errors.map((err, i) => (
                      <p key={i} className="text-[11px] text-red-700">{err}</p>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex gap-2 flex-wrap">
                  <button
                    onClick={() => handlePushLive(c.id, c.speaking_level)}
                    disabled={!allGreen || submitting === c.id}
                    className="rounded-lg bg-[#FE6E3E] px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-[#E55A2B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {submitting === c.id ? "Pushing Live..." : "Push Live"}
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
