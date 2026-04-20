"use client";

import { useEffect, useState } from "react";
import { labelFor, isMediaField } from "@/lib/editFieldLabels";
import USExperiencePicker from "@/components/candidate/USExperiencePicker";
import WorkExperienceEditor from "@/components/candidate/edit/WorkExperienceEditor";
import { ROLE_CATEGORY_GROUPS, YEARS_EXPERIENCE_OPTIONS } from "@/lib/candidateOptions";
import type { WorkExperienceEntry } from "@/lib/candidateOptions";

type Props = {
  fieldName: string;
  currentValue: unknown;
  onClose: () => void;
  onSubmitted: () => void;
};

export default function EditModal({ fieldName, currentValue, onClose, onSubmitted }: Props) {
  const [value, setValue] = useState<unknown>(initialValue(fieldName, currentValue));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setError("");
    if (!isValueFilled(fieldName, value)) {
      setError("Please provide a new value.");
      return;
    }
    setSubmitting(true);

    let payloadValue: unknown = value;

    // Media fields: upload the file to staging first, then submit the path.
    if (isMediaField(fieldName) && value instanceof File) {
      const form = new FormData();
      form.append("file", value);
      form.append("field_name", fieldName);
      const uploadResp = await fetch("/api/candidate/edit-requests/upload-staged-media", {
        method: "POST",
        body: form,
      });
      if (!uploadResp.ok) {
        const body = await uploadResp.json().catch(() => ({}));
        setError(body.error ?? "Upload failed");
        setSubmitting(false);
        return;
      }
      const { staged_path } = await uploadResp.json();
      payloadValue = staged_path;
    }

    if (fieldName === "hourly_rate" && typeof payloadValue === "string") {
      payloadValue = Number(payloadValue);
    }

    const resp = await fetch("/api/candidate/edit-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field_name: fieldName, new_value: payloadValue }),
    });
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}));
      setError(body.error ?? "Failed to submit");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSubmitted();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-text">Edit {labelFor(fieldName)}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text/60 hover:bg-gray-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-text/60 mb-1">Current value</label>
          <CurrentValueDisplay fieldName={fieldName} value={currentValue} />
        </div>

        <div className="mt-4">
          <label className="block text-xs font-medium text-text/60 mb-1.5">New value</label>
          <FieldForm fieldName={fieldName} value={value} onChange={setValue} disabled={submitting} />
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-text hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit for review"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────────────────────── Helpers ──────────────────────────

function initialValue(fieldName: string, current: unknown): unknown {
  if (fieldName === "skills" || fieldName === "tools") {
    return Array.isArray(current) ? [...current] : [];
  }
  if (fieldName === "work_experience") {
    return Array.isArray(current) ? (current as WorkExperienceEntry[]) : [];
  }
  if (isMediaField(fieldName)) return null;
  return "";
}

function isValueFilled(fieldName: string, v: unknown): boolean {
  if (fieldName === "skills" || fieldName === "tools") {
    return Array.isArray(v) && v.length > 0;
  }
  if (fieldName === "work_experience") {
    return Array.isArray(v) && v.length > 0 && (v as WorkExperienceEntry[]).every((e) => e.role_title && e.industry);
  }
  if (isMediaField(fieldName)) return v instanceof File;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !Number.isNaN(v);
  return v !== null && v !== undefined;
}

// ────────────────────────── Current value display ──────────────────────────

function CurrentValueDisplay({ fieldName, value }: { fieldName: string; value: unknown }) {
  if (value === null || value === undefined || value === "") {
    return <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-text/40 italic">(none set)</p>;
  }
  if (fieldName === "skills" || fieldName === "tools") {
    const arr = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="flex flex-wrap gap-1.5">
        {arr.map((t) => (
          <span key={t} className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-text">{t}</span>
        ))}
      </div>
    );
  }
  if (fieldName === "work_experience") {
    const entries = (value as WorkExperienceEntry[]) ?? [];
    return (
      <ul className="space-y-1 text-sm text-text/70">
        {entries.map((e, i) => (
          <li key={i}>
            • {e.role_title} {e.company_name ? `@ ${e.company_name}` : ""}
          </li>
        ))}
      </ul>
    );
  }
  if (isMediaField(fieldName)) {
    return <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-text/70 break-all">{String(value)}</p>;
  }
  return <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-text whitespace-pre-wrap">{String(value)}</p>;
}

// ────────────────────────── Per-field form ──────────────────────────

function FieldForm({
  fieldName,
  value,
  onChange,
  disabled,
}: {
  fieldName: string;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
}) {
  const input =
    "block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50";

  if (fieldName === "bio") {
    return (
      <textarea
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        maxLength={300}
        disabled={disabled}
        className={input}
      />
    );
  }
  if (fieldName === "tagline") {
    return (
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        maxLength={80}
        disabled={disabled}
        className={input}
      />
    );
  }
  if (fieldName === "country") {
    return (
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={input}
      />
    );
  }
  if (fieldName === "hourly_rate") {
    return (
      <input
        type="number"
        min={1}
        max={500}
        step={0.5}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={input}
      />
    );
  }
  if (fieldName === "years_experience") {
    return (
      <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={input}>
        <option value="">Select...</option>
        {YEARS_EXPERIENCE_OPTIONS.map((o) => (
          <option key={o} value={o}>{o} years</option>
        ))}
      </select>
    );
  }
  if (fieldName === "role_category") {
    return (
      <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={input}>
        <option value="">Select a role...</option>
        {ROLE_CATEGORY_GROUPS.map((g) => (
          <optgroup key={g.group} label={g.group}>
            {g.roles.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </optgroup>
        ))}
      </select>
    );
  }
  if (fieldName === "us_client_experience") {
    return <USExperiencePicker value={(value as string) ?? ""} onChange={(v) => onChange(v)} disabled={disabled} />;
  }
  if (fieldName === "skills" || fieldName === "tools") {
    return <TagListEditor value={(value as string[]) ?? []} onChange={(v) => onChange(v)} disabled={disabled} />;
  }
  if (fieldName === "work_experience") {
    return (
      <WorkExperienceEditor
        value={(value as WorkExperienceEntry[]) ?? []}
        onChange={(v) => onChange(v)}
        disabled={disabled}
      />
    );
  }
  if (isMediaField(fieldName)) {
    return <MediaPicker fieldName={fieldName} value={value as File | null} onChange={onChange} disabled={disabled} />;
  }

  return <p className="text-sm text-red-600">No form for field {fieldName}</p>;
}

// ────────────────────────── Tag list (skills / tools) ──────────────────────────

function TagListEditor({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled: boolean }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary">
            {t}
            <button
              type="button"
              onClick={() => onChange(value.filter((x) => x !== t))}
              disabled={disabled}
              className="text-primary/70 hover:text-primary"
              aria-label={`Remove ${t}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          disabled={disabled}
          placeholder="Add and press Enter"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50"
        />
        <button
          type="button"
          onClick={add}
          disabled={disabled || !draft.trim()}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
    </div>
  );
}

// ────────────────────────── Media picker (image / audio / video) ──────────────────────────

function MediaPicker({
  fieldName,
  value,
  onChange,
  disabled,
}: {
  fieldName: string;
  value: File | null;
  onChange: (v: unknown) => void;
  disabled: boolean;
}) {
  const accept =
    fieldName === "profile_photo_url"
      ? "image/*"
      : fieldName === "video_intro_url"
      ? "video/*"
      : "audio/*";
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  return (
    <div className="space-y-2">
      <input
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        disabled={disabled}
        className="block w-full text-sm text-text/70 file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-primary/90"
      />
      {previewUrl && fieldName === "profile_photo_url" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="preview" className="max-h-48 rounded-lg border border-gray-200" />
      )}
      {previewUrl && fieldName === "video_intro_url" && (
        <video src={previewUrl} controls className="max-h-48 w-full rounded-lg border border-gray-200" />
      )}
      {previewUrl && (fieldName === "voice_recording_1_url" || fieldName === "voice_recording_2_url") && (
        <audio src={previewUrl} controls className="w-full" />
      )}
      {value && <p className="text-xs text-text/60">{value.name} · {(value.size / 1024).toFixed(1)} KB</p>}
    </div>
  );
}

