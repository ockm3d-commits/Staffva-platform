"use client";

import { useEffect, useState } from "react";
import { labelFor } from "@/lib/editFieldLabels";

type EditRequest = {
  id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  status: "pending" | "approved" | "declined" | "cancelled";
  decline_reason: string | null;
  submitted_at: string;
  resolved_at: string | null;
};

type Props = {
  refreshKey: number;
  onChanged: () => void;
};

export default function PendingEditsSection({ refreshKey, onChanged }: Props) {
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/candidate/edit-requests")
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        setRequests(body.requests ?? []);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  async function cancel(id: string) {
    setCancellingId(id);
    const resp = await fetch(`/api/candidate/edit-requests/${id}/cancel`, { method: "POST" });
    setCancellingId(null);
    if (resp.ok) onChanged();
  }

  if (loading) return <p className="text-sm text-text/60">Loading your edit requests…</p>;

  if (requests.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-text/60">
        No edit requests yet. Click &ldquo;Edit&rdquo; on any field to request a change.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {requests.map((r) => (
        <li key={r.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text">{labelFor(r.field_name)}</span>
                <StatusBadge status={r.status} />
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <ValuePanel label="Before" value={r.old_value} field={r.field_name} />
                <ValuePanel label="After" value={r.new_value} field={r.field_name} />
              </div>
              {r.status === "declined" && r.decline_reason && (
                <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
                  <strong>Declined:</strong> {r.decline_reason}
                </p>
              )}
              <p className="mt-2 text-[11px] text-text/50">Submitted {new Date(r.submitted_at).toLocaleString()}</p>
            </div>
            {r.status === "pending" && (
              <button
                type="button"
                onClick={() => cancel(r.id)}
                disabled={cancellingId === r.id}
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-text hover:bg-gray-50 disabled:opacity-50"
              >
                {cancellingId === r.id ? "Cancelling…" : "Cancel"}
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: EditRequest["status"] }) {
  const styles: Record<EditRequest["status"], string> = {
    pending: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
    declined: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-600",
  };
  const label = status[0].toUpperCase() + status.slice(1);
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status]}`}>{label}</span>;
}

function ValuePanel({ label, value, field }: { label: string; value: unknown; field: string }) {
  const isArr = Array.isArray(value);
  const isEmpty = value === null || value === undefined || value === "" || (isArr && (value as unknown[]).length === 0);
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-text/40">{label}</p>
      <div className="mt-0.5 rounded-md bg-gray-50 px-2.5 py-1.5 text-xs text-text">
        {isEmpty ? (
          <span className="italic text-text/40">(empty)</span>
        ) : isArr ? (
          <span>{(value as unknown[]).slice(0, 6).map(String).join(", ")}{(value as unknown[]).length > 6 ? "…" : ""}</span>
        ) : typeof value === "object" ? (
          <span className="italic text-text/60">(complex value — {field})</span>
        ) : (
          <span className="break-words">{String(value).slice(0, 160)}{String(value).length > 160 ? "…" : ""}</span>
        )}
      </div>
    </div>
  );
}
