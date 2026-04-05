"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MatchCTASection() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/match?q=${encodeURIComponent(query.trim())}`);
    } else {
      router.push("/match");
    }
  }

  return (
    <section className="bg-[#1C1B1A] py-20">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white">
          Ready to build with leverage?
        </h2>
        <p className="mt-3 text-white/50 text-sm">
          Tell us what you need. Our AI matches you with the right professional in seconds.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            rows={3}
            placeholder="Describe what you need. We'll find who can do it."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-sm text-white placeholder-white/30 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Find My Match
          </button>
        </form>
      </div>
    </section>
  );
}
