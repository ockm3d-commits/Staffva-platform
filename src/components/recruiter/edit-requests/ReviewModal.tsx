"use client";

import { useEffect, useState } from "react";
import { labelFor, isMediaField, MEDIA_FIELD_BUCKET } from "@/lib/editFieldLabels";

type Candidate = { id: string; display_name: string | null; profile_photo_url: string | null };

type EditRequestDetail = {
  id: string;
  field_name: string;
  old_value: unknown;
  new_value: unknown;
  status: "pending" | "approved" | "declined" | "cancelled";
  decline_reason: string | null;
  submitted_at: string;
  resolved_at: string | null;
  candidate: Candidate;
};

type Props = {
  editRequestId: string;
  onClose: () => void;
  onResolved: () => void;
};

export default function ReviewModal({ editRequestId, onClose, onResolved }: Props) {
  const [detail, setDetail] = useState<EditRequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"review" | "declining">("review");
  const [declineReason, setDeclineReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/recruiter/edit-requests/${editRequestId}`)
      .then((r) => r.json())
      .then((body) => {
        if (cancelled) return;
        if (body.request) setDetail(body.request as EditRequestDetail);
        else setError(body.error ?? "Failed to load");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [editRequestId]);

  async function approve() {
    if (!detail) return;
    setSubmitting(true);
    setError("");
    const resp = await fetch(`/api/recruiter/edit-requests/${detail.id}/approve`, { method: "POST" });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      setError(body.error ?? "Approve failed");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onResolved();
  }

  async function decline() {
    if (!detail) return;
    const reason = declineReason.trim();
    if (!reason) {
      setError("Decline reason is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    const resp = await fetch(`/api/recruiter/edit-requests/${detail.id}/decline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decline_reason: reason }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      setError(body.error ?? "Decline failed");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onResolved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1C1B1A]">
              Review edit request
            </h2>
            {detail && (
              <p className="mt-0.5 text-xs text-gray-500">
                {detail.candidate?.display_name ?? "Candidate"} · {labelFor(detail.field_name)}
              </p>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-500 hover:bg-gray-100" aria-label="Close">✕</button>
        </div>

        {loading && <p className="mt-6 text-sm text-gray-500">Loading…</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {detail && (
          <>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ValueBlock title="Current (live)" fieldName={detail.field_name} value={detail.old_value} />
              <ValueBlock title="Proposed change" fieldName={detail.field_name} value={detail.new_value} highlight />
            </div>

            {detail.status !== "pending" && (
              <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                This request is already <strong>{detail.status}</strong>
                {detail.resolved_at ? ` (${new Date(detail.resolved_at).toLocaleString()})` : ""}
                {detail.decline_reason ? ` — Reason: ${detail.decline_reason}` : ""}
              </div>
            )}

            {detail.status === "pending" && mode === "review" && (
              <div className="mt-6 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMode("declining")}
                  disabled={submitting}
                  className="rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={approve}
                  disabled={submitting}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {submitting ? "Approving…" : "Approve"}
                </button>
              </div>
            )}

            {detail.status === "pending" && mode === "declining" && (
              <div className="mt-6 space-y-3">
                <label className="block">
                  <span className="block text-sm font-medium text-[#1C1B1A]">Reason for decline (required)</span>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    disabled={submitting}
                    rows={3}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    placeholder="Explain why this edit was declined…"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("review")}
                    disabled={submitting}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-[#1C1B1A] hover:bg-gray-50 disabled:opacity-50"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={decline}
                    disabled={submitting || !declineReason.trim()}
                    className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {submitting ? "Declining…" : "Confirm decline"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ValueBlock({
  title,
  fieldName,
  value,
  highlight,
}: {
  title: string;
  fieldName: string;
  value: unknown;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className={`text-[10px] font-semibold uppercase tracking-wide ${highlight ? "text-[#FE6E3E]" : "text-gray-500"}`}>
        {title}
      </p>
      <div className={`mt-1 rounded-lg border px-3 py-2 ${highlight ? "border-[#FE6E3E]/30 bg-[#FE6E3E]/5" : "border-gray-200 bg-gray-50"}`}>
        <ValueRender fieldName={fieldName} value={value} />
      </div>
    </div>
  );
}

function ValueRender({ fieldName, value }: { fieldName: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <p className="text-xs italic text-gray-400">(none)</p>;
  }
  if (isMediaField(fieldName) && typeof value === "string") {
    return <MediaRender fieldName={fieldName} value={value} />;
  }
  if (Array.isArray(value)) {
    if (fieldName === "skills" || fieldName === "tools") {
      return (
        <div className="flex flex-wrap gap-1">
          {(value as string[]).map((t) => (
            <span key={t} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#1C1B1A] border border-gray-200">{t}</span>
          ))}
        </div>
      );
    }
    if (fieldName === "work_experience") {
      return (
        <ul className="space-y-1 text-[12px] text-[#1C1B1A]">
          {(value as Array<{ role_title?: string; company_name?: string; duration?: string; description?: string }>).map((e, i) => (
            <li key={i}>
              <p className="font-medium">{e.role_title} {e.company_name ? `@ ${e.company_name}` : ""}</p>
              {e.duration && <p className="text-gray-500">{e.duration}</p>}
              {e.description && <p className="text-gray-600 line-clamp-3">{e.description}</p>}
            </li>
          ))}
        </ul>
      );
    }
    return <p className="text-xs text-[#1C1B1A]">{(value as unknown[]).map(String).join(", ")}</p>;
  }
  return <p className="whitespace-pre-wrap break-words text-xs text-[#1C1B1A]">{String(value)}</p>;
}

function MediaRender({ fieldName, value }: { fieldName: string; value: string }) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const bucket = MEDIA_FIELD_BUCKET[fieldName];

  useEffect(() => {
    let cancelled = false;
    // profile_photo_url may already be a full public URL (live / approved).
    if (fieldName === "profile_photo_url" && value.startsWith("http")) {
      setSignedUrl(value);
      return;
    }
    const path = value.replace(`${bucket}/`, "");
    // profile-photos is a public bucket — construct the public URL directly
    // rather than going through the signed-url endpoint (which excludes this bucket).
    if (fieldName === "profile_photo_url") {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (base) setSignedUrl(`${base}/storage/v1/object/public/${bucket}/${path}`);
      return;
    }
    fetch("/api/storage/signed-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket, path }),
    })
      .then((r) => r.json())
      .then((body) => { if (!cancelled) setSignedUrl(body.signedUrl ?? null); })
      .catch(() => { /* silent */ });
    return () => { cancelled = true; };
  }, [fieldName, value, bucket]);

  if (!signedUrl) return <p className="text-xs text-gray-400">Loading preview…</p>;

  if (fieldName === "profile_photo_url") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={signedUrl} alt="" className="max-h-40 rounded-lg" />;
  }
  if (fieldName === "video_intro_url") {
    return <video src={signedUrl} controls className="max-h-40 w-full rounded-lg" />;
  }
  return <audio src={signedUrl} controls className="w-full" />;
}
