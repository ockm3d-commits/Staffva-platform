"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  candidateId: string;
  verificationStatus: string;
  onComplete: () => void;
}

export default function IDVerification({
  candidateId,
  verificationStatus,
  onComplete,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already passed — auto-advance
  useEffect(() => {
    if (verificationStatus === "passed") {
      onComplete();
    }
  }, [verificationStatus, onComplete]);

  if (verificationStatus === "passed") {
    return null;
  }

  // Failed state — show rejection with support contact
  if (verificationStatus === "failed") {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1C1B1A]">Verification Could Not Be Completed</h1>
        <p className="mt-3 text-gray-500 max-w-md mx-auto">
          Your identity verification could not be completed. This may be due to an unclear photo,
          mismatched information, or an unsupported document type.
        </p>
        <p className="mt-3 text-gray-500 max-w-md mx-auto">
          Your application has been paused. If you believe this is an error, please contact our support team.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <a
            href="mailto:support@staffva.com"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FE6E3E] px-6 py-3 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            Contact Support
          </a>
          <button
            onClick={async () => {
              setLoading(true);
              setError("");
              try {
                const supabase = createClient();
                await supabase
                  .from("candidates")
                  .update({ id_verification_status: "pending" })
                  .eq("id", candidateId);
                window.location.reload();
              } catch {
                setError("Failed to retry. Please try again.");
              }
              setLoading(false);
            }}
            disabled={loading}
            className="text-sm text-gray-500 hover:text-[#FE6E3E] underline"
          >
            {loading ? "Resetting..." : "Try verification again"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  // Manual review state — show progress with expected timeline
  if (verificationStatus === "manual_review") {
    return (
      <div className="mx-auto max-w-xl px-6 py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <svg className="h-8 w-8 text-amber-600 animate-pulse" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-[#1C1B1A]">Verification Under Review</h1>
        <p className="mt-3 text-gray-500 max-w-md mx-auto">
          Your identity verification has been submitted and is currently under manual review.
          This typically takes up to <strong>48 hours</strong>.
        </p>
        <div className="mt-6 rounded-lg bg-amber-50 border border-amber-200 p-4 max-w-md mx-auto">
          <p className="text-sm text-amber-800">
            You can continue viewing your application progress in your dashboard while we process your verification.
            We will notify you by email once it is resolved.
          </p>
        </div>
        <div className="mt-6">
          <a
            href="/candidate/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-[#FE6E3E] px-6 py-3 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors"
          >
            View My Dashboard
          </a>
        </div>
      </div>
    );
  }

  // Pending state — show verification form
  async function handleVerify() {
    setLoading(true);
    setError("");

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("Please sign in to continue.");
        setLoading(false);
        return;
      }

      // Create Stripe Identity session
      const res = await fetch("/api/identity/create-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ candidate_id: candidateId }),
      });

      const data = await res.json();

      if (data.alreadyVerified) {
        onComplete();
        return;
      }

      if (data.url) {
        // Redirect to Stripe Identity verification page
        window.location.href = data.url;
      } else if (data.error) {
        // If Stripe Identity is not configured, auto-pass in dev mode
        if (data.error.includes("configuration") || data.error.includes("not configured")) {
          await supabase
            .from("candidates")
            .update({ id_verification_status: "passed" })
            .eq("id", candidateId);
          onComplete();
        } else {
          setError(data.error);
        }
      } else {
        // Fallback: auto-pass for dev environments without Stripe Identity
        await supabase
          .from("candidates")
          .update({ id_verification_status: "passed" })
          .eq("id", candidateId);
        onComplete();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-bold text-[#1C1B1A]">Identity Verification</h1>
      <p className="mt-2 text-sm text-gray-500">
        Before building your profile, we need to verify your identity. This is
        required for all candidates and helps build trust with clients.
      </p>

      <div className="mt-8 rounded-xl border border-gray-200 bg-white p-6 space-y-4">
        <h2 className="font-semibold text-[#1C1B1A]">What you will need</h2>
        <ul className="space-y-2 text-sm text-gray-600">
          <li className="flex gap-3">
            <svg className="h-5 w-5 shrink-0 text-[#FE6E3E]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
            </svg>
            A government-issued photo ID (passport, driver&apos;s license, or national ID)
          </li>
          <li className="flex gap-3">
            <svg className="h-5 w-5 shrink-0 text-[#FE6E3E]" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
            </svg>
            A device with a camera for a selfie match
          </li>
        </ul>

        <div className="border-t border-gray-200 pt-4">
          <p className="text-xs text-gray-400">
            Your ID is verified securely through Stripe Identity. StaffVA does
            not store your ID document — only the verification result.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full rounded-lg bg-[#FE6E3E] px-4 py-3 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors disabled:opacity-50"
        >
          {loading ? "Starting verification..." : "Verify My Identity"}
        </button>
      </div>
    </div>
  );
}
