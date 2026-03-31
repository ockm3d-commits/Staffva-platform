"use client";

import { useState, useEffect } from "react";

interface QueueStats {
  counts: {
    pending: number;
    processing: number;
    complete: number;
    failed: number;
    rate_limited: number;
  };
  total: number;
  processedToday: number;
  recentFailures: {
    id: string;
    candidate_id: string;
    error_text: string;
    retry_count: number;
    created_at: string;
  }[];
}

export default function ScreeningQueueWidget() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const res = await fetch("/api/admin/screening-queue");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch { /* silent */ }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#FE6E3E] border-t-transparent" />
          <span className="text-sm text-gray-500">Loading screening queue...</span>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const { counts } = stats;
  const activeCount = counts.pending + counts.processing + counts.rate_limited;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="text-sm font-semibold text-[#1C1B1A]">AI Screening Queue</h3>
          {activeCount > 0 && (
            <span className="flex h-2 w-2 rounded-full bg-[#FE6E3E] animate-pulse" />
          )}
        </div>
        <span className="text-xs text-gray-400">Updates every 30s</span>
      </div>

      <div className="grid grid-cols-5 gap-2">
        <div className="rounded-lg bg-yellow-50 p-2.5 text-center">
          <p className="text-lg font-bold text-yellow-700">{counts.pending}</p>
          <p className="text-[10px] text-yellow-600 font-medium">Pending</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-2.5 text-center">
          <p className="text-lg font-bold text-blue-700">{counts.processing}</p>
          <p className="text-[10px] text-blue-600 font-medium">Processing</p>
        </div>
        <div className="rounded-lg bg-green-50 p-2.5 text-center">
          <p className="text-lg font-bold text-green-700">{counts.complete}</p>
          <p className="text-[10px] text-green-600 font-medium">Complete</p>
        </div>
        <div className="rounded-lg bg-red-50 p-2.5 text-center">
          <p className="text-lg font-bold text-red-700">{counts.failed}</p>
          <p className="text-[10px] text-red-600 font-medium">Failed</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-2.5 text-center">
          <p className="text-lg font-bold text-amber-700">{counts.rate_limited}</p>
          <p className="text-[10px] text-amber-600 font-medium">Rate Ltd</p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>Total: {stats.total}</span>
        <span>Today: {stats.processedToday} screened</span>
      </div>

      {stats.recentFailures.length > 0 && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="text-[10px] font-medium text-red-600 uppercase tracking-wide mb-1">Recent Failures</p>
          {stats.recentFailures.slice(0, 3).map((f) => (
            <p key={f.id} className="text-[11px] text-gray-500 truncate">
              {f.error_text?.slice(0, 60) || "Unknown error"} (retry {f.retry_count})
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
