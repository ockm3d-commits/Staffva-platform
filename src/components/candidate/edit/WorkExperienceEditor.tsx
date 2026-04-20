"use client";

import { useState } from "react";
import type { WorkExperienceEntry } from "@/lib/candidateOptions";

type Props = {
  value: WorkExperienceEntry[];
  onChange: (next: WorkExperienceEntry[]) => void;
  disabled?: boolean;
};

function emptyEntry(): WorkExperienceEntry {
  return { company_name: "", role_title: "", industry: "", duration: "", description: "", start_date: "", end_date: "" };
}

export default function WorkExperienceEditor({ value, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState<number | null>(value.length === 0 ? 0 : null);

  const update = (idx: number, patch: Partial<WorkExperienceEntry>) => {
    const next = value.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    onChange(next);
  };

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx));

  const move = (idx: number, delta: -1 | 1) => {
    const to = idx + delta;
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    [next[idx], next[to]] = [next[to], next[idx]];
    onChange(next);
  };

  const add = () => {
    const next = [...value, emptyEntry()];
    onChange(next);
    setExpanded(next.length - 1);
  };

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <p className="text-xs text-text/60">No entries yet. Click &ldquo;Add Entry&rdquo; to start.</p>
      )}
      {value.map((entry, idx) => {
        const isOpen = expanded === idx;
        return (
          <div key={idx} className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-3 py-2">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : idx)}
                className="flex-1 text-left text-sm font-medium text-text"
                disabled={disabled}
              >
                {entry.role_title || entry.company_name || `Entry ${idx + 1}`}
                {entry.company_name && entry.role_title ? (
                  <span className="ml-2 text-xs text-text/60">@ {entry.company_name}</span>
                ) : null}
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(idx, -1)}
                  disabled={disabled || idx === 0}
                  className="rounded px-2 py-1 text-xs text-text/60 hover:bg-gray-100 disabled:opacity-30"
                  aria-label="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(idx, 1)}
                  disabled={disabled || idx === value.length - 1}
                  className="rounded px-2 py-1 text-xs text-text/60 hover:bg-gray-100 disabled:opacity-30"
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  disabled={disabled}
                  className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
            {isOpen && (
              <div className="space-y-2 border-t border-gray-100 px-3 py-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Company"
                    value={entry.company_name ?? ""}
                    onChange={(e) => update(idx, { company_name: e.target.value })}
                    disabled={disabled}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Role title"
                    value={entry.role_title}
                    onChange={(e) => update(idx, { role_title: e.target.value })}
                    disabled={disabled}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Industry"
                    value={entry.industry}
                    onChange={(e) => update(idx, { industry: e.target.value })}
                    disabled={disabled}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Duration (e.g. 2 years)"
                    value={entry.duration}
                    onChange={(e) => update(idx, { duration: e.target.value })}
                    disabled={disabled}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={entry.start_date ?? ""}
                    onChange={(e) => update(idx, { start_date: e.target.value })}
                    disabled={disabled}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={entry.end_date ?? ""}
                    onChange={(e) => update(idx, { end_date: e.target.value })}
                    disabled={disabled}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <textarea
                  placeholder="Description of your responsibilities"
                  value={entry.description}
                  onChange={(e) => update(idx, { description: e.target.value })}
                  disabled={disabled}
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        disabled={disabled}
        className="w-full rounded-lg border-2 border-dashed border-gray-300 px-3 py-2.5 text-sm font-medium text-text/70 hover:border-primary/40 hover:text-primary disabled:opacity-50"
      >
        + Add Entry
      </button>
    </div>
  );
}
