"use client";

import { useEffect, useState } from "react";

/**
 * Two-step US client experience picker.
 * Step 1: Yes / No radio.
 * Step 2: conditional secondary select — duration buckets if Yes, context
 *         options if No. Values map to us_experience_type enum (migration 00080).
 *
 * Controlled component — parent owns the string value. Empty string ('') means
 * "not yet answered"; the component derives the Yes/No branch from the value.
 */

export const DURATION_OPTIONS = [
  { value: "less_than_6_months", label: "Less than 6 months" },
  { value: "6_months_to_1_year", label: "6 months to 1 year" },
  { value: "1_to_2_years", label: "1 to 2 years" },
  { value: "2_to_5_years", label: "2 to 5 years" },
  { value: "5_plus_years", label: "5+ years" },
] as const;

export const NO_OPTIONS = [
  { value: "international_only", label: "I've worked with international clients (non-US)" },
  { value: "none", label: "This would be my first international client" },
] as const;

export const DURATION_VALUES = DURATION_OPTIONS.map((o) => o.value) as string[];
export const NO_VALUES = NO_OPTIONS.map((o) => o.value) as string[];

export type USExperienceValue = "" | (typeof DURATION_OPTIONS)[number]["value"] | (typeof NO_OPTIONS)[number]["value"];

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Prefix for radio name so multiple pickers on one page don't collide. */
  idPrefix?: string;
};

function branchFor(value: string): "yes" | "no" | "" {
  if (DURATION_VALUES.includes(value)) return "yes";
  if (NO_VALUES.includes(value)) return "no";
  return "";
}

export default function USExperiencePicker({ value, onChange, disabled = false, idPrefix = "us-exp" }: Props) {
  const [yesNo, setYesNo] = useState<"yes" | "no" | "">(() => branchFor(value));

  useEffect(() => {
    setYesNo(branchFor(value));
  }, [value]);

  function handleYesNo(v: "yes" | "no") {
    setYesNo(v);
    // Clear secondary value if the current value doesn't belong to the new branch.
    if ((v === "yes" && !DURATION_VALUES.includes(value)) || (v === "no" && !NO_VALUES.includes(value))) {
      onChange("");
    }
  }

  const radioName = `${idPrefix}-yesno`;

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-text mb-2">
          Do you have US client experience? <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 transition-colors ${
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:border-primary/30"
              }`}
            >
              <input
                type="radio"
                name={radioName}
                value={opt.value}
                checked={yesNo === opt.value}
                disabled={disabled}
                onChange={(e) => handleYesNo(e.target.value as "yes" | "no")}
                className="text-primary focus:ring-primary"
              />
              <span className="text-sm text-text">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {yesNo === "yes" && (
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1.5">
            How long have you worked with US clients?
          </label>
          <select
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="">Select duration...</option>
            {DURATION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {yesNo === "no" && (
        <div>
          <label className="block text-xs font-medium text-text/60 mb-1.5">Tell us a bit more</label>
          <select
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-4 py-3 text-sm focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            <option value="">Select an option...</option>
            {NO_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
