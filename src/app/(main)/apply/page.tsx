"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import ApplicationForm from "@/components/apply/ApplicationForm";
import DeviceCheck from "@/components/apply/DeviceCheck";
import TestInstructions from "@/components/apply/TestInstructions";
import EnglishTest from "@/components/apply/EnglishTest";
import TestResult from "@/components/apply/TestResult";
import VoiceRecording1 from "@/components/apply/VoiceRecording1";
import VoiceRecording2 from "@/components/apply/VoiceRecording2";
import ProfileBuilder from "@/components/apply/ProfileBuilder";

export type ApplicationStep =
  | "loading"
  | "application_form"
  | "device_check"
  | "test_instructions"
  | "english_test"
  | "test_result"
  | "voice_recording_1"
  | "voice_recording_2"
  | "profile_builder"
  | "complete";

export interface CandidateData {
  id: string;
  full_name: string;
  display_name: string | null;
  email: string;
  country: string;
  role_category: string;
  years_experience: string;
  monthly_rate: number;
  time_zone: string;
  linkedin_url: string;
  bio: string;
  us_client_experience: string;
  us_client_description: string;
  english_mc_score: number | null;
  english_comprehension_score: number | null;
  english_percentile: number | null;
  english_written_tier: string | null;
  speaking_level: string | null;
  admin_status: string;
  id_verification_status: string;
  voice_recording_1_url: string | null;
  voice_recording_2_url: string | null;
  resume_url: string | null;
  payout_method: string | null;
  availability_status: string;
  permanently_blocked: boolean;
  retake_count: number;
  retake_available_at: string | null;
  application_step: string;
  profile_completed_at: string | null;
}

export default function ApplyPage() {
  const [step, setStep] = useState<ApplicationStep>("loading");
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [testPassed, setTestPassed] = useState(false);

  useEffect(() => {
    loadCandidateState();
  }, []);

  // Save the current step to the database
  async function saveStep(newStep: ApplicationStep, candidateId?: string) {
    const id = candidateId || candidateData?.id;
    if (!id || newStep === "loading") return;

    const supabase = createClient();
    await supabase
      .from("candidates")
      .update({ application_step: newStep })
      .eq("id", id);
  }

  // Set step in state AND save to database
  async function goToStep(newStep: ApplicationStep, candidateId?: string) {
    setStep(newStep);
    await saveStep(newStep, candidateId);
  }

  async function loadCandidateState() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    const { data: candidate } = await supabase
      .from("candidates")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!candidate) {
      setStep("application_form");
      return;
    }

    setCandidateData(candidate);

    // If permanently blocked from retakes, show result
    if (candidate.permanently_blocked) {
      setStep("test_result");
      return;
    }

    // Profile is fully complete (has profile_completed_at)
    if (candidate.profile_completed_at) {
      setStep("complete");
      return;
    }

    // Use the saved application_step from the database
    // But also validate against actual data to prevent skipping ahead
    const savedStep = candidate.application_step as ApplicationStep;

    // Validate: if saved step says voice recordings but test not passed, correct it
    if (candidate.english_mc_score !== null) {
      const passed =
        candidate.english_mc_score >= 70 &&
        (candidate.english_comprehension_score ?? 0) >= 70;
      setTestPassed(passed);

      if (!passed) {
        setStep("test_result");
        return;
      }
    }

    // Validate: if both recordings exist and profile not built, go to profile builder
    if (candidate.voice_recording_1_url && candidate.voice_recording_2_url && !candidate.profile_completed_at) {
      setStep("profile_builder");
      return;
    }

    // Validate: if recording 1 exists but not 2, go to recording 2
    if (candidate.voice_recording_1_url && !candidate.voice_recording_2_url) {
      setStep("voice_recording_2");
      return;
    }

    // If test completed and passed but no recordings, go to recording 1
    if (candidate.english_mc_score !== null && !candidate.voice_recording_1_url) {
      const passed =
        candidate.english_mc_score >= 70 &&
        (candidate.english_comprehension_score ?? 0) >= 70;
      if (passed) {
        setStep("voice_recording_1");
        return;
      }
    }

    // Otherwise use the saved step, with fallback logic
    const validSteps: ApplicationStep[] = [
      "application_form", "device_check", "test_instructions",
      "english_test", "test_result", "voice_recording_1",
      "voice_recording_2", "profile_builder", "complete"
    ];

    if (validSteps.includes(savedStep)) {
      setStep(savedStep);
    } else {
      // Fallback: determine step from data
      if (!candidate.english_mc_score) {
        setStep("device_check");
      } else {
        setStep("application_form");
      }
    }
  }

  function handleFormComplete(data: CandidateData) {
    setCandidateData(data);
    goToStep("device_check", data.id);
  }

  function handleDeviceCheckPass() {
    goToStep("test_instructions");
  }

  function handleTestStart() {
    goToStep("english_test");
  }

  function handleTestComplete(passed: boolean, updatedCandidate: CandidateData) {
    setCandidateData(updatedCandidate);
    setTestPassed(passed);
    if (passed) {
      goToStep("voice_recording_1", updatedCandidate.id);
    } else {
      goToStep("test_result", updatedCandidate.id);
    }
  }

  function handleRecording1Complete(url: string) {
    setCandidateData((prev) =>
      prev ? { ...prev, voice_recording_1_url: url } : prev
    );
    goToStep("voice_recording_2");
  }

  function handleRecording2Complete(url: string) {
    setCandidateData((prev) =>
      prev ? { ...prev, voice_recording_2_url: url } : prev
    );
    goToStep("profile_builder");
  }

  function handleProfileComplete() {
    goToStep("complete");
  }

  if (step === "loading") {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-background">
        <p className="text-text/60">Loading your application...</p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-73px)] bg-background">
      {/* Progress bar */}
      {step !== "complete" && step !== "test_result" && (
        <div className="mx-auto max-w-3xl px-6 pt-6">
          <div className="flex items-center gap-1">
            {["application_form", "english_test", "voice_recording_1", "voice_recording_2", "profile_builder"].map((s, i) => {
              const stepOrder = ["application_form", "device_check", "test_instructions", "english_test", "test_result", "voice_recording_1", "voice_recording_2", "profile_builder"];
              const currentIndex = stepOrder.indexOf(step);
              const thisIndex = stepOrder.indexOf(s);
              const isComplete = currentIndex > thisIndex;
              const isCurrent = step === s || (s === "english_test" && (step === "device_check" || step === "test_instructions" || step === "english_test"));
              return (
                <div key={s} className="flex-1">
                  <div className={`h-1.5 rounded-full ${isComplete ? "bg-primary" : isCurrent ? "bg-primary/50" : "bg-gray-200"}`} />
                  <p className="mt-1 text-[10px] text-text/40 text-center">
                    {["Application", "English Test", "Reading", "Introduction", "Profile"][i]}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {step === "application_form" && (
        <ApplicationForm onComplete={handleFormComplete} />
      )}
      {step === "device_check" && (
        <DeviceCheck onPass={handleDeviceCheckPass} />
      )}
      {step === "test_instructions" && (
        <TestInstructions onStart={handleTestStart} />
      )}
      {step === "english_test" && candidateData && (
        <EnglishTest
          candidateId={candidateData.id}
          onComplete={handleTestComplete}
        />
      )}
      {step === "test_result" && candidateData && (
        <TestResult candidate={candidateData} passed={testPassed} />
      )}
      {step === "voice_recording_1" && candidateData && (
        <VoiceRecording1
          candidateId={candidateData.id}
          onComplete={handleRecording1Complete}
        />
      )}
      {step === "voice_recording_2" && candidateData && (
        <VoiceRecording2
          candidateId={candidateData.id}
          onComplete={handleRecording2Complete}
        />
      )}
      {step === "profile_builder" && candidateData && (
        <ProfileBuilder
          candidateId={candidateData.id}
          candidateData={{
            full_name: candidateData.full_name,
            display_name: candidateData.display_name,
            role_category: candidateData.role_category,
            monthly_rate: candidateData.monthly_rate,
            bio: candidateData.bio,
            english_written_tier: candidateData.english_written_tier,
            speaking_level: candidateData.speaking_level,
          }}
          onComplete={handleProfileComplete}
        />
      )}
      {step === "complete" && candidateData && (
        <div className="mx-auto max-w-xl px-6 py-16 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text">
            {candidateData.admin_status === "approved"
              ? "Your Profile is Live"
              : "Application Complete"}
          </h1>
          <p className="mt-3 text-text/60">
            {candidateData.admin_status === "approved"
              ? "Your profile is live and visible to clients. You will be notified when a client sends you a message."
              : "Your profile is complete and under review. We will notify you within 2 business days once your speaking assessment is complete and your profile is live."}
          </p>

          {candidateData.admin_status !== "approved" && (
            <div className="mt-8 text-left mx-auto max-w-sm">
              <h3 className="font-semibold text-text mb-3">What happens next:</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm text-text/70">Application submitted</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm text-text/70">English assessment completed</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm text-text/70">Voice recordings submitted</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <span className="text-sm text-text/70">Profile built</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 mt-0.5 shrink-0 rounded-full border-2 border-primary flex items-center justify-center">
                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                  </div>
                  <span className="text-sm text-text/70 font-medium">Speaking assessment review — in progress</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="h-5 w-5 mt-0.5 shrink-0 rounded-full border-2 border-gray-300" />
                  <span className="text-sm text-text/40">Profile goes live</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
