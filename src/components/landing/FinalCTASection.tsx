"use client";

import Link from "next/link";

export default function FinalCTASection() {
  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text">
          Ready when you are.
        </h2>
        <p className="mt-4 text-lg text-text-muted">
          No signup required. No subscription. No catch.
        </p>

        <div className="mt-10">
          <Link
            href="/browse"
            className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Browse
          </Link>
        </div>
      </div>
    </section>
  );
}
