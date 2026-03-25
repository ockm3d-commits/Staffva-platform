"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ViewStats {
  weekViews: number;
  monthViews: number;
  totalViews: number;
}

interface CandidateData {
  id: string;
  display_name: string;
  admin_status: string;
  role_category: string;
  monthly_rate: number;
  availability_status: string;
  total_earnings_usd: number;
  profile_photo_url: string | null;
  english_written_tier: string | null;
  speaking_level: string | null;
  tagline: string | null;
  bio: string | null;
  skills: string[] | null;
  tools: string[] | null;
  work_experience: unknown[] | null;
  resume_url: string | null;
  payout_method: string | null;
  english_mc_score: number | null;
  voice_recording_1_url: string | null;
  voice_recording_2_url: string | null;
  profile_completed_at: string | null;
  id_verification_status: string | null;
  application_step: string | null;
}

interface InterviewData {
  interview_number: number;
  status: string;
  communication_score: number | null;
  demeanor_score: number | null;
  role_knowledge_score: number | null;
}

type StepStatus = "completed" | "current" | "upcoming";

function getProgressSteps(c: CandidateData, interviews: InterviewData[]): { label: string; status: StepStatus; detail?: string }[] {
  // Determine completion state for each step based on actual data only
  const step1Done = true; // Candidate record exists = application submitted
  const step2Done = (c.english_mc_score ?? 0) > 0;
  const step3Done = c.id_verification_status === "passed" || !!c.voice_recording_1_url;
  const step4Done = !!c.profile_photo_url && !!c.resume_url;
  const aiInterview = interviews.find((i) => i.interview_number === 1 && i.status === "completed");
  const step5Done = !!aiInterview;
  const secondInterview = interviews.find((i) => i.interview_number === 2 && i.status === "completed");
  const step6Done = !!secondInterview;
  const step7Done = c.admin_status === "approved";

  function status(done: boolean, prevDone: boolean): StepStatus {
    if (done) return "completed";
    if (prevDone) return "current";
    return "upcoming";
  }

  const steps: { label: string; status: StepStatus; detail?: string }[] = [
    {
      label: "Application Submitted",
      status: "completed",
      detail: undefined,
    },
    {
      label: "English Assessment",
      status: status(step2Done, step1Done),
      detail: step2Done ? undefined : "Complete the English grammar and comprehension test",
    },
    {
      label: "ID Verification",
      status: status(step3Done, step2Done),
      detail: step3Done ? undefined : "Verify your identity",
    },
    {
      label: "Profile Builder",
      status: status(step4Done, step3Done),
      detail: step4Done ? undefined : "Complete your profile — photo, bio, experience, and resume",
    },
    {
      label: "AI First Interview",
      status: status(step5Done, step4Done),
      detail: step5Done
        ? `Score: ${Math.round((((aiInterview?.communication_score || 0) + (aiInterview?.demeanor_score || 0) + (aiInterview?.role_knowledge_score || 0)) / 15) * 100)}/100`
        : step4Done ? "Start your AI-powered interview" : undefined,
    },
    {
      label: "Second Interview",
      status: status(step6Done, step5Done),
      detail: step6Done ? undefined : step5Done ? "Scheduled by StaffVA team" : undefined,
    },
    {
      label: "Profile Live",
      status: status(step7Done, step6Done),
      detail: step7Done ? "Your profile is visible to clients" : step6Done ? "Awaiting admin approval" : undefined,
    },
  ];

  return steps;
}

interface CompletenessItem {
  label: string;
  points: number;
  complete: boolean;
  tip: string;
  link: string;
}

function calculateCompleteness(c: CandidateData, hasPortfolio: boolean): { score: number; items: CompletenessItem[] } {
  const items: CompletenessItem[] = [
    {
      label: "Profile photo",
      points: 10,
      complete: !!c.profile_photo_url,
      tip: "Upload a professional photo to make your profile stand out",
      link: "/apply",
    },
    {
      label: "Tagline",
      points: 10,
      complete: !!c.tagline && c.tagline.length > 0,
      tip: "Add a short tagline describing your expertise",
      link: "/apply",
    },
    {
      label: "Bio",
      points: 10,
      complete: !!c.bio && c.bio.length > 0,
      tip: "Write a bio telling clients about your background",
      link: "/apply",
    },
    {
      label: "At least 3 skills",
      points: 10,
      complete: Array.isArray(c.skills) && c.skills.length >= 3,
      tip: "Add at least 3 key skills to your profile",
      link: "/apply",
    },
    {
      label: "At least 3 tools",
      points: 10,
      complete: Array.isArray(c.tools) && c.tools.length >= 3,
      tip: "List the tools and software you use regularly",
      link: "/apply",
    },
    {
      label: "Work experience",
      points: 15,
      complete: Array.isArray(c.work_experience) && c.work_experience.length >= 1,
      tip: "Add at least one work experience entry",
      link: "/apply",
    },
    {
      label: "Resume uploaded",
      points: 15,
      complete: !!c.resume_url,
      tip: "Upload your resume so clients can review your full background",
      link: "/apply",
    },
    {
      label: "Portfolio item",
      points: 10,
      complete: hasPortfolio,
      tip: "Add a work sample, cover letter, or certificate",
      link: "/apply",
    },
    {
      label: "Payout method",
      points: 10,
      complete: !!c.payout_method,
      tip: "Set up your payout method to receive payments",
      link: "/apply",
    },
  ];

  const score = items.reduce((sum, item) => sum + (item.complete ? item.points : 0), 0);
  return { score, items };
}

export default function CandidateDashboardPage() {
  const [candidate, setCandidate] = useState<CandidateData | null>(null);
  const [viewStats, setViewStats] = useState<ViewStats | null>(null);
  const [interviews, setInterviews] = useState<InterviewData[]>([]);
  const [hasPortfolio, setHasPortfolio] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: c } = await supabase
        .from("candidates")
        .select("id, display_name, admin_status, role_category, monthly_rate, availability_status, total_earnings_usd, profile_photo_url, english_written_tier, speaking_level, tagline, bio, skills, tools, work_experience, resume_url, payout_method, english_mc_score, voice_recording_1_url, voice_recording_2_url, profile_completed_at, id_verification_status, application_step")
        .eq("user_id", session.user.id)
        .single();

      if (c) {
        setCandidate(c as CandidateData);

        // Check portfolio
        const { count } = await supabase
          .from("portfolio_items")
          .select("*", { count: "exact", head: true })
          .eq("candidate_id", c.id);
        setHasPortfolio((count || 0) > 0);

        // Load interviews
        const { data: interviewData } = await supabase
          .from("candidate_interviews")
          .select("interview_number, status, communication_score, demeanor_score, role_knowledge_score")
          .eq("candidate_id", c.id);
        if (interviewData) setInterviews(interviewData as InterviewData[]);
      }

      try {
        const res = await fetch("/api/profile-views", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const stats = await res.json();
          setViewStats(stats);
        }
      } catch { /* silent */ }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#FE6E3E] border-t-transparent" />
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-[#1C1B1A]">No profile found</h1>
        <p className="mt-2 text-sm text-gray-500">Complete your application to see your dashboard.</p>
        <Link href="/apply" className="mt-4 inline-block rounded-lg bg-[#FE6E3E] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#E55A2B]">
          Start Application
        </Link>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    pending_speaking_review: { label: "Under Review", color: "text-yellow-700", bgColor: "bg-yellow-50 border-yellow-200" },
    approved: { label: "Live", color: "text-green-700", bgColor: "bg-green-50 border-green-200" },
    rejected: { label: "Not Approved", color: "text-red-700", bgColor: "bg-red-50 border-red-200" },
    revision_required: { label: "Revision Needed", color: "text-orange-700", bgColor: "bg-orange-50 border-orange-200" },
    deactivated: { label: "Deactivated", color: "text-gray-700", bgColor: "bg-gray-50 border-gray-200" },
  };

  const status = statusConfig[candidate.admin_status] || statusConfig.pending_speaking_review;
  const { score: completenessScore, items: completenessItems } = calculateCompleteness(candidate, hasPortfolio);
  const nextTip = completenessItems.find((item) => !item.complete);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-gray-100">
          {candidate.profile_photo_url ? (
            <img src={candidate.profile_photo_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xl font-bold text-gray-400">
              {candidate.display_name?.charAt(0) || "?"}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1C1B1A]">
            Welcome back, {candidate.display_name?.split(" ")[0] || "there"}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.bgColor} ${status.color}`}>
              {status.label}
            </span>
            <span className="text-sm text-gray-500">{candidate.role_category}</span>
          </div>
        </div>
      </div>

      {/* Next Step Action Button */}
      {(() => {
        const hasPassedTest = (candidate.english_mc_score ?? 0) >= 70 && (candidate.english_written_tier !== null);
        const hasRecordings = !!candidate.voice_recording_1_url && !!candidate.voice_recording_2_url;
        const profileDone = !!candidate.profile_photo_url && !!candidate.resume_url;
        const aiDone = interviews.some((i) => i.interview_number === 1 && i.status === "completed");

        if (aiDone) return null; // No button needed — green badge shows in tracker

        let label = "";
        let href = "/apply";

        if (!hasPassedTest && !hasRecordings) {
          label = candidate.english_mc_score ? "Continue English Test" : "Continue Application";
        } else if (hasPassedTest && !hasRecordings) {
          label = "Continue Application";
        } else if (hasRecordings && !profileDone) {
          label = "Continue Profile Setup";
        } else if (profileDone && !aiDone) {
          label = "Start AI Interview";
          href = `https://interview.staffva.com?candidate=${candidate.id}`;
        }

        if (!label) return null;

        return (
          <div className="mb-6">
            <a
              href={href}
              target={href.startsWith("http") ? "_blank" : undefined}
              rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FE6E3E] px-6 py-3 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors shadow-sm"
            >
              {label === "Start AI Interview" && (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
              {label} →
            </a>
          </div>
        );
      })()}

      {/* Progress Tracker */}
      {(() => {
        const steps = getProgressSteps(candidate, interviews);
        const aiInterview = interviews.find((i) => i.interview_number === 1 && i.status === "completed");
        const aiInterviewPending = interviews.find((i) => i.interview_number === 1 && i.status !== "completed");
        const profileBuilderDone = !!candidate.profile_photo_url && !!candidate.resume_url;

        return (
          <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Your Progress</h2>
            <div className="relative">
              {steps.map((step, i) => (
                <div key={step.label} className="flex items-start gap-3 pb-4 last:pb-0">
                  {/* Vertical line */}
                  <div className="flex flex-col items-center">
                    {step.status === "completed" ? (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500">
                        <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : step.status === "current" ? (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#FE6E3E] ring-4 ring-orange-100">
                        <span className="text-xs font-bold text-white">{i + 1}</span>
                      </div>
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-gray-200 bg-gray-50">
                        <span className="text-xs font-medium text-gray-400">{i + 1}</span>
                      </div>
                    )}
                    {i < steps.length - 1 && (
                      <div className={`mt-1 h-6 w-0.5 ${step.status === "completed" ? "bg-green-300" : "bg-gray-200"}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pt-0.5">
                    <p className={`text-sm font-medium ${
                      step.status === "completed" ? "text-green-700" : step.status === "current" ? "text-[#1C1B1A]" : "text-gray-400"
                    }`}>
                      {step.label}
                    </p>
                    {step.detail && (
                      <p className={`mt-0.5 text-xs ${step.status === "completed" ? "text-green-600" : step.status === "current" ? "text-gray-500" : "text-gray-400"}`}>
                        {step.detail}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* AI Interview Button */}
            {profileBuilderDone && !aiInterview && !aiInterviewPending && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <a
                  href={`https://interview.staffva.com?candidate=${candidate.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-[#FE6E3E] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Start AI Interview
                </a>
                <p className="mt-1.5 text-xs text-gray-500">20-minute AI-powered structured interview. Available now.</p>
              </div>
            )}

            {aiInterview && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-green-50 border border-green-200 px-4 py-2">
                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-sm font-medium text-green-700">
                    AI Interview Complete — {Math.round((((aiInterview.communication_score || 0) + (aiInterview.demeanor_score || 0) + (aiInterview.role_knowledge_score || 0)) / 15) * 100)}/100
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Status messages */}
      {candidate.admin_status === "pending_speaking_review" && (
        <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
          <p className="text-sm font-medium text-yellow-800">Your profile is under review</p>
          <p className="mt-1 text-sm text-yellow-700">We will notify you within 2 business days once your speaking assessment is complete and your profile is live.</p>
        </div>
      )}
      {candidate.admin_status === "revision_required" && (
        <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <p className="text-sm font-medium text-orange-800">Action required</p>
          <p className="mt-1 text-sm text-orange-700">Our team has reviewed your profile and left feedback. Check your email for details on what to update.</p>
          <Link href="/apply" className="mt-2 inline-block text-sm font-medium text-[#FE6E3E] hover:underline">Edit my profile →</Link>
        </div>
      )}

      {/* Profile Completeness */}
      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Profile Completeness</h2>
          <span className={`text-lg font-bold ${completenessScore === 100 ? "text-green-600" : completenessScore >= 70 ? "text-[#FE6E3E]" : "text-yellow-600"}`}>
            {completenessScore}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completenessScore === 100 ? "bg-green-500" : "bg-[#FE6E3E]"}`}
            style={{ width: `${completenessScore}%` }}
          />
        </div>

        {/* Next tip */}
        {nextTip && completenessScore < 100 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-[#FE6E3E]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-[#1C1B1A]">
              <span className="font-medium">Next step (+{nextTip.points}%):</span>{" "}
              {nextTip.tip}
            </p>
            <Link href={nextTip.link} className="ml-auto shrink-0 text-xs font-medium text-[#FE6E3E] hover:underline">
              Complete →
            </Link>
          </div>
        )}

        {completenessScore === 100 && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-50 border border-green-100 px-3 py-2">
            <svg className="h-4 w-4 shrink-0 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-xs text-green-700 font-medium">Your profile is 100% complete. You&apos;re maximizing your visibility to clients.</p>
          </div>
        )}

        {/* Checklist */}
        <div className="mt-4 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {completenessItems.map((item) => (
            <div key={item.label} className="flex items-center gap-2 text-sm">
              {item.complete ? (
                <svg className="h-4 w-4 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <div className="h-4 w-4 shrink-0 rounded-full border-2 border-gray-300" />
              )}
              <span className={item.complete ? "text-gray-500 line-through" : "text-[#1C1B1A]"}>
                {item.label}
              </span>
              <span className="text-xs text-gray-400">+{item.points}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Views This Week</p>
          <p className="mt-1 text-2xl font-bold text-[#1C1B1A]">{viewStats?.weekViews || 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Views This Month</p>
          <p className="mt-1 text-2xl font-bold text-[#1C1B1A]">{viewStats?.monthViews || 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total Views</p>
          <p className="mt-1 text-2xl font-bold text-[#1C1B1A]">{viewStats?.totalViews || 0}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Earnings</p>
          <p className="mt-1 text-2xl font-bold text-green-600">${(candidate.total_earnings_usd || 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link href={`/candidate/${candidate.id}`} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 text-lg">👤</span>
            <div>
              <p className="text-sm font-semibold text-[#1C1B1A]">View My Profile</p>
              <p className="text-xs text-gray-500">See how clients see you</p>
            </div>
          </Link>
          <Link href="/apply" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-lg">✏️</span>
            <div>
              <p className="text-sm font-semibold text-[#1C1B1A]">Edit Profile</p>
              <p className="text-xs text-gray-500">Update your info and skills</p>
            </div>
          </Link>
          {candidate.admin_status === "approved" && (
            <Link href="/services" className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-4 hover:shadow-sm transition-shadow">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-lg">📦</span>
              <div>
                <p className="text-sm font-semibold text-[#1C1B1A]">My Services</p>
                <p className="text-xs text-gray-500">Manage service packages</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Profile details card */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500">Profile Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Role</p>
            <p className="font-medium text-[#1C1B1A]">{candidate.role_category}</p>
          </div>
          <div>
            <p className="text-gray-500">Monthly Rate</p>
            <p className="font-medium text-[#FE6E3E]">${candidate.monthly_rate?.toLocaleString()}/mo</p>
          </div>
          <div>
            <p className="text-gray-500">Availability</p>
            <p className="font-medium text-[#1C1B1A] capitalize">{candidate.availability_status?.replace(/_/g, " ") || "Not set"}</p>
          </div>
          <div>
            <p className="text-gray-500">English Level</p>
            <p className="font-medium text-[#1C1B1A] capitalize">{candidate.english_written_tier || "Pending"}</p>
          </div>
          <div>
            <p className="text-gray-500">Speaking Level</p>
            <p className="font-medium text-[#1C1B1A] capitalize">{candidate.speaking_level || "Pending review"}</p>
          </div>
          <div>
            <p className="text-gray-500">Verified Earnings</p>
            <p className="font-medium text-green-600">${(candidate.total_earnings_usd || 0).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
