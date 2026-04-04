"use client";

import Link from "next/link";

export default function FinalCTASection() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
          See who&apos;s available.
        </h2>
        <p className="mt-4 text-lg text-text-muted">
          No signup. No subscription. No catch.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/browse"
            className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Browse Talent
          </Link>
          <Link
            href="/apply"
            className="text-sm font-medium text-text-secondary hover:text-primary transition-colors"
          >
            Are you a professional? Apply here →
          </Link>
        </div>
      </div>
    </section>
  );
}
