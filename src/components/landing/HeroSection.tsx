"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface HeroCandidate {
  id: string;
  display_name: string;
  role_category: string;
  monthly_rate: number;
  english_written_tier: string | null;
  country: string;
  profile_photo_url: string | null;
}

interface Props {
  heroPreview: HeroCandidate[];
}

export default function HeroSection({ heroPreview: _heroPreview }: Props) {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    router.push(query.trim() ? `/browse?search=${encodeURIComponent(query.trim())}` : "/browse");
  }

  return (
    <section className="relative bg-card overflow-hidden">
      {/* Generous vertical space — Apple hero pacing */}
      <div className="mx-auto max-w-4xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28 lg:pt-40 lg:pb-36 text-center">

        {/* Eyebrow — quiet, earned */}
        <p className="text-sm font-medium tracking-widest uppercase text-primary">
          Vetted talent marketplace
        </p>

        {/* Headline — one idea, owns the viewport */}
        <h1 className="mt-6 text-[2.75rem] sm:text-6xl lg:text-7xl font-semibold leading-[1.05] tracking-tight text-text">
          The talent you need.
          <br />
          <span className="text-primary">Already proven.</span>
        </h1>

        {/* Subhead — one breath, benefit-first */}
        <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl text-text-muted leading-relaxed">
          Every professional on StaffVA passed a live English and speaking
          assessment. Browse profiles, hear voice recordings, and hire
          through escrow.
        </p>

        {/* CTA cluster — primary + secondary, nothing else */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/browse"
            className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Browse Talent
          </Link>
          <Link
            href="/apply"
            className="rounded-full border border-border px-8 py-3.5 text-sm font-semibold text-text hover:border-text transition-colors"
          >
            Apply as a Professional
          </Link>
        </div>

        {/* Search — secondary action, calm */}
        <form onSubmit={handleSearch} className="mx-auto mt-10 flex max-w-md gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Try "paralegal" or "bookkeeper"'
            className="flex-1 rounded-full border border-border-light bg-background px-5 py-3 text-sm text-text placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          />
          <button
            type="submit"
            className="rounded-full bg-charcoal px-5 py-3 text-sm font-medium text-white hover:bg-charcoal/90 transition-colors"
          >
            Search
          </button>
        </form>

        {/* Trust line — whisper, not shout */}
        <p className="mt-8 text-xs text-text-tertiary tracking-wide">
          Free to browse · Escrow on every payment · Zero candidate fees
        </p>
      </div>
    </section>
  );
}
