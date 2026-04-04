"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

export default function ContractSignPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contractId = params.contractId as string;
  const token = searchParams.get("token") || "";

  const [contractHtml, setContractHtml] = useState("");
  const [clientName, setClientName] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadContract();
  }, [contractId, token]);

  async function loadContract() {
    try {
      const url = `/api/contracts/view?contractId=${contractId}${token ? `&token=${token}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to load contract");
        setLoading(false);
        return;
      }

      setContractHtml(data.contractHtml);
      setClientName(data.clientName);
      setCandidateName(data.candidateName);
      setStatus(data.status);
      setLoading(false);

      // If already fully executed, show that state
      if (data.status === "fully_executed") {
        setSigned(true);
      }
    } catch {
      setError("Failed to load contract. The link may have expired.");
      setLoading(false);
    }
  }

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 50) {
      setHasScrolledToBottom(true);
    }
  }, []);

  async function handleSign() {
    setSigning(true);
    setError("");

    try {
      const res = await fetch("/api/contracts/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractId, role: "candidate", token }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to sign contract");
        setSigning(false);
        return;
      }

      setSigned(true);
    } catch {
      setError("Something went wrong. Please try again.");
      setSigning(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-text-muted">Loading contract...</p>
        </div>
      </main>
    );
  }

  if (error && !contractHtml) {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-background">
        <div className="mx-auto max-w-md text-center px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-text">Unable to Load Contract</h1>
          <p className="mt-2 text-sm text-text-muted">{error}</p>
          <a href="mailto:support@staffva.com" className="mt-4 inline-block text-sm text-primary hover:underline">
            Contact Support
          </a>
        </div>
      </main>
    );
  }

  if (signed) {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-background">
        <div className="mx-auto max-w-md text-center px-6">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-text">Contract Signed Successfully</h1>
          <p className="mt-2 text-sm text-text-muted">
            The Independent Contractor Agreement between you and {clientName} is now fully executed. Both parties will receive a PDF copy via email.
          </p>
          <button
            onClick={() => router.push("/candidate/dashboard")}
            className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </main>
    );
  }

  // Contract not in signing state for candidate
  if (status !== "pending_candidate") {
    return (
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center bg-background">
        <div className="mx-auto max-w-md text-center px-6">
          <h1 className="text-xl font-semibold text-text">Contract Not Ready</h1>
          <p className="mt-2 text-sm text-text-muted">
            {status === "pending_client"
              ? "This contract is still awaiting the client's signature."
              : "This contract has already been processed."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-50 border-b border-border bg-card px-6 py-4 shadow-sm">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-lg font-semibold text-text">Independent Contractor Agreement</h1>
          <p className="text-xs text-text-muted">
            Review your contract with {clientName} and scroll to the bottom to sign
          </p>
        </div>
      </div>

      {/* Contract body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="mx-auto max-w-3xl px-6 py-8"
        style={{ maxHeight: "calc(100vh - 140px)", overflowY: "auto" }}
      >
        <div
          className="rounded-xl border border-border-light bg-white p-8 shadow-sm"
          dangerouslySetInnerHTML={{ __html: contractHtml }}
        />

        {/* Signature area */}
        <div className="mt-8 rounded-xl border border-border bg-card p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <svg className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-text">Sign this contract</h3>
              <p className="mt-1 text-sm text-text-muted">
                By clicking &quot;Sign Contract&quot;, you agree to the terms above as <strong>{candidateName}</strong>.
                Your signature and IP address will be recorded.
              </p>

              {/* Scroll notice */}
              {!hasScrolledToBottom && (
                <div className="mt-3 flex items-center gap-2 text-xs text-amber-600">
                  <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3" />
                  </svg>
                  Please scroll through the entire contract before signing
                </div>
              )}

              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}

              <button
                onClick={handleSign}
                disabled={!hasScrolledToBottom || signing}
                className="mt-4 rounded-full bg-primary px-8 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {signing ? "Signing..." : "Sign Contract"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
