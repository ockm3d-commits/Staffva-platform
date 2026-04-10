"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ScreeningQueueWidget from "@/components/admin/ScreeningQueueWidget";
import IdentitySummaryWidget from "@/components/admin/IdentitySummaryWidget";

interface ClientHealth {
  id: string;
  name: string;
  company: string | null;
  lastLogin: string;
  daysSinceLogin: number;
  activeEngagements: number;
  totalFees: number;
  createdAt: string;
  churningRisk: boolean;
}

interface Metrics {
  liveCandidates: number;
  activeEngagements: number;
  mrr: number;
  candidatesThisWeek: number;
  candidatesLastWeek: number;
  candidatesThisMonth: number;
  clientsThisWeek: number;
  clientsThisMonth: number;
  totalThreads: number;
  pendingReviews: number;
  activeDisputes: number;
  appChangePercent: number;
  browsedNotHired: number;
  sparklines: {
    liveCandidates: number[];
  };
  alerts: {
    banPending: number;
    disputesPast48h: number;
    webhookFailures: number;
    webhookFailuresList: { id: string; event_type: string; error_message: string; created_at: string }[];
    manualReview: number;
    screeningFails: number;
    stalledRevisions: number;
    payoutNotSetup: number;
  };
  clientHealth: ClientHealth[];
  talentPool: {
    liveCandidates: number;
    rolesBelow2: number;
  };
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} className="inline-block ml-2">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/metrics").then((res) => {
      if (res.status === 403) {
        router.replace("/recruiter");
        return null;
      }
      return res.json();
    }).then((data) => {
      if (!data) return;
      setMetrics(data);
      setLoading(false);
    });
  }, [router]);

  if (loading || !metrics) {
    return <p className="text-text/60">Loading dashboard...</p>;
  }

  const hasAlerts =
    metrics.alerts.banPending > 0 ||
    metrics.alerts.disputesPast48h > 0 ||
    metrics.alerts.webhookFailures > 0 ||
    metrics.alerts.manualReview > 0 ||
    metrics.alerts.screeningFails > 0 ||
    metrics.alerts.stalledRevisions > 0 ||
    metrics.alerts.payoutNotSetup > 0;

  return (
    <div>
      <h1 className="text-2xl font-bold text-text">Platform Dashboard</h1>

      {/* Pending reviews alert */}
      {metrics.pendingReviews > 0 && (
        <Link
          href="/admin/candidates"
          className="mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 hover:bg-amber-100 transition-colors"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-800">
            {metrics.pendingReviews}
          </span>
          <span className="text-sm font-medium text-amber-800">
            candidates pending review
          </span>
          <span className="ml-auto text-xs text-amber-600">Review now &rarr;</span>
        </Link>
      )}

      {/* LEADING INDICATORS — above fold */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Applications this week */}
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">Applications This Week</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text">{metrics.candidatesThisWeek}</span>
            <span className={`text-sm font-semibold flex items-center gap-0.5 ${metrics.appChangePercent >= 0 ? "text-green-600" : "text-red-500"}`}>
              {metrics.appChangePercent >= 0 ? "\u2191" : "\u2193"} {Math.abs(metrics.appChangePercent)}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-text/40">vs {metrics.candidatesLastWeek} last week</p>
        </div>

        {/* Candidates Live */}
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">Candidates Live</p>
          <div className="mt-2 flex items-center">
            <span className="text-3xl font-bold text-text">{metrics.liveCandidates}</span>
            <Sparkline data={metrics.sparklines.liveCandidates} color="#22c55e" />
          </div>
          <p className="mt-1 text-[11px] text-text/40">4-week trend</p>
        </div>

        {/* Browsed Not Hired */}
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">Browsed, Not Hired</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-text">{metrics.browsedNotHired}</span>
          </div>
          <p className="mt-1 text-[11px] text-text/40">clients viewed profiles in 14d, no active engagement</p>
        </div>
      </div>

      {/* BUSINESS HEALTH METRICS with sparklines */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">MRR</p>
          <p className="mt-2 text-3xl font-bold text-primary">${metrics.mrr.toLocaleString()}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">Active Engagements</p>
          <p className="mt-2 text-3xl font-bold text-text">{metrics.activeEngagements}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">New Clients (Week)</p>
          <p className="mt-2 text-3xl font-bold text-blue-600">{metrics.clientsThisWeek}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">New Clients (Month)</p>
          <p className="mt-2 text-3xl font-bold text-text">{metrics.clientsThisMonth}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">New Candidates (Month)</p>
          <p className="mt-2 text-3xl font-bold text-text">{metrics.candidatesThisMonth}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-card p-5">
          <p className="text-xs font-medium text-text/40 uppercase tracking-wider">Active Message Threads</p>
          <p className="mt-2 text-3xl font-bold text-text">{metrics.totalThreads}</p>
        </div>
      </div>

      {/* ALERTS — only if active */}
      {hasAlerts && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-text mb-3">Alerts</h2>
          <div className="space-y-3">
            {/* Red alerts */}
            {metrics.alerts.banPending > 0 && (
              <Link href="/admin/pending-bans" className="flex items-center gap-3 rounded-xl border-l-4 border-red-500 bg-red-50 px-5 py-3 hover:bg-red-100 transition-colors">
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{metrics.alerts.banPending}</span>
                <span className="text-sm font-medium text-red-800">Pending ban requests</span>
                <span className="ml-auto text-xs text-red-600">Review &rarr;</span>
              </Link>
            )}
            {metrics.alerts.disputesPast48h > 0 && (
              <Link href="/admin/disputes" className="flex items-center gap-3 rounded-xl border-l-4 border-red-500 bg-red-50 px-5 py-3 hover:bg-red-100 transition-colors">
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{metrics.alerts.disputesPast48h}</span>
                <span className="text-sm font-medium text-red-800">Disputed payments past 48 hours</span>
                <span className="ml-auto text-xs text-red-600">Review &rarr;</span>
              </Link>
            )}
            {metrics.alerts.webhookFailures > 0 && (
              <div className="rounded-xl border-l-4 border-red-500 bg-red-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">{metrics.alerts.webhookFailures}</span>
                  <span className="text-sm font-medium text-red-800">Stripe webhook failures</span>
                </div>
                {metrics.alerts.webhookFailuresList.length > 0 && (
                  <div className="mt-2 space-y-1 ml-10">
                    {metrics.alerts.webhookFailuresList.map((wf) => (
                      <p key={wf.id} className="text-xs text-red-700">{wf.event_type}: {wf.error_message}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Amber alerts */}
            {metrics.alerts.manualReview > 0 && (
              <Link href="/admin/identity" className="flex items-center gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-5 py-3 hover:bg-amber-100 transition-colors">
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{metrics.alerts.manualReview}</span>
                <span className="text-sm font-medium text-amber-800">Identity manual review required</span>
                <span className="ml-auto text-xs text-amber-600">Review &rarr;</span>
              </Link>
            )}
            {metrics.alerts.screeningFails > 0 && (
              <div className="flex items-center gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-5 py-3">
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{metrics.alerts.screeningFails}</span>
                <span className="text-sm font-medium text-amber-800">AI screening queue failures (&gt;2h)</span>
              </div>
            )}
            {metrics.alerts.stalledRevisions > 0 && (
              <div className="flex items-center gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-5 py-3">
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{metrics.alerts.stalledRevisions}</span>
                <span className="text-sm font-medium text-amber-800">Stalled revision requests (&gt;72h)</span>
                <span className="ml-auto text-xs text-amber-600">Managed by Manar</span>
              </div>
            )}
            {metrics.alerts.payoutNotSetup > 0 && (
              <Link href="/admin/candidates?status=approved" className="flex items-center gap-3 rounded-xl border-l-4 border-amber-500 bg-amber-50 px-5 py-3 hover:bg-amber-100 transition-colors">
                <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">{metrics.alerts.payoutNotSetup}</span>
                <span className="text-sm font-medium text-amber-800">Approved candidates have not set up their payout account (&gt;48h)</span>
                <span className="ml-auto text-xs text-amber-600">View &rarr;</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Screening & Identity Widgets */}
      <div className="mt-6">
        <ScreeningQueueWidget />
      </div>
      <div className="mt-4">
        <IdentitySummaryWidget />
      </div>

      {/* CLIENT HEALTH */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-text mb-3">Client Health</h2>

        {/* Talent Pool link card */}
        <Link
          href="/talent-pool"
          className="mb-4 flex items-center gap-4 rounded-xl border border-gray-200 bg-card p-4 hover:border-primary/30 transition-colors"
        >
          <div className="flex-1">
            <p className="text-xs font-medium text-text/40 uppercase tracking-wider">Talent Pool Health</p>
            <p className="mt-0.5 text-sm text-text">
              <span className="font-bold">{metrics.talentPool.liveCandidates}</span> live candidates
              {metrics.talentPool.rolesBelow2 > 0 && (
                <span className="text-red-500 ml-2">&middot; {metrics.talentPool.rolesBelow2} role{metrics.talentPool.rolesBelow2 > 1 ? "s" : ""} below healthy ratio</span>
              )}
            </p>
          </div>
          <span className="text-xs text-primary font-medium">View &rarr;</span>
        </Link>

        <div className="rounded-xl border border-gray-200 bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-text/40 text-[10px] font-semibold uppercase">
                  <th className="px-4 py-2.5 text-left">Client</th>
                  <th className="px-4 py-2.5 text-center">Last Login</th>
                  <th className="px-4 py-2.5 text-center">Engagements</th>
                  <th className="px-4 py-2.5 text-center">Total Fees</th>
                  <th className="px-4 py-2.5 text-center">Joined</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.clientHealth.slice(0, 25).map((c) => (
                  <tr key={c.id} className={`border-b border-gray-50 ${c.churningRisk ? "bg-orange-50" : ""}`}>
                    <td className="px-4 py-2.5 text-left">
                      <p className="font-medium text-text text-xs">{c.name}</p>
                      {c.company && <p className="text-[10px] text-text/40">{c.company}</p>}
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-text/60">{relativeTime(c.lastLogin)}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-semibold text-text">{c.activeEngagements}</td>
                    <td className="px-4 py-2.5 text-center text-xs font-semibold text-primary">${c.totalFees.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-center text-xs text-text/40">{new Date(c.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                    <td className="px-4 py-2.5 text-center">
                      {c.churningRisk ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">Churn risk</span>
                      ) : c.activeEngagements > 0 ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">Active</span>
                      ) : (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">Inactive</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Disputes */}
      {metrics.activeDisputes > 0 && (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-5 py-3 flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-200 text-sm font-bold text-red-800">
            {metrics.activeDisputes}
          </span>
          <span className="text-sm font-medium text-red-800">
            active {metrics.activeDisputes === 1 ? "dispute" : "disputes"} awaiting resolution
          </span>
        </div>
      )}
    </div>
  );
}
