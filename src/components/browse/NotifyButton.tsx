"use client";

import { useState } from "react";
import Link from "next/link";

interface Props {
  candidateId: string;
  isLoggedIn: boolean;
}

export default function NotifyButton({ candidateId, isLoggedIn }: Props) {
  const [requested, setRequested] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleNotify() {
    setLoading(true);
    const res = await fetch("/api/notifications/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateId }),
    });
    const data = await res.json();
    if (data.success) {
      setRequested(true);
    }
    setLoading(false);
  }

  if (!isLoggedIn) {
    return (
      <Link
        href="/signup/client"
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
      >
        Sign in to get notified
      </Link>
    );
  }

  if (requested) {
    return (
      <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2.5 text-sm font-medium text-green-700">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
        You will be notified when available
      </div>
    );
  }

  return (
    <button
      onClick={handleNotify}
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
      {loading ? "Requesting..." : "Notify me when available"}
    </button>
  );
}
