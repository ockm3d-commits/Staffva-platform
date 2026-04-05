"use client";

import { useState } from "react";
import Image from "next/image";

interface Props {
  onAccept: () => void;
}

export default function IntegrityPledge({ onAccept }: Props) {
  const [checked, setChecked] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="mx-auto max-w-lg px-6 py-12 text-center">
        {/* Logo */}
        <div className="mb-8">
          <Image src="/logo.svg" alt="StaffVA" width={140} height={50} className="mx-auto" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-[#1C1B1A]">Before you begin your assessment</h1>

        {/* Pledge text */}
        <div className="mt-6 text-left rounded-xl border border-gray-200 bg-gray-50 p-6">
          <p className="text-sm text-[#1C1B1A] leading-relaxed">
            This assessment measures your real English ability. The results directly affect your profile quality and the trust clients place in StaffVA professionals.
          </p>
          <p className="mt-4 text-sm font-medium text-[#1C1B1A]">By proceeding you agree to:</p>
          <ul className="mt-3 space-y-2.5">
            <li className="flex items-start gap-2.5 text-sm text-[#1C1B1A]">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Complete this assessment without assistance from any other person
            </li>
            <li className="flex items-start gap-2.5 text-sm text-[#1C1B1A]">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Not use translation tools, AI tools, or any external resources
            </li>
            <li className="flex items-start gap-2.5 text-sm text-[#1C1B1A]">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Remain on this screen for the duration of the test
            </li>
            <li className="flex items-start gap-2.5 text-sm text-[#1C1B1A]">
              <svg className="h-4 w-4 mt-0.5 shrink-0 text-primary" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Represent your true language ability honestly
            </li>
          </ul>
        </div>

        {/* Checkbox */}
        <label className="mt-6 flex items-start gap-3 cursor-pointer text-left">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-sm text-[#1C1B1A] font-medium">
            I understand and agree to complete this assessment with full integrity.
          </span>
        </label>

        {/* Button */}
        <button
          onClick={onAccept}
          disabled={!checked}
          className="mt-6 w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white hover:bg-[#E55A2B] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Begin Assessment
        </button>
      </div>
    </div>
  );
}
