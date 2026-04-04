import Link from "next/link";

interface Props {
  totalApproved: number;
  uniqueCountries: number;
}

export default function ForCandidatesSection({ totalApproved, uniqueCountries }: Props) {
  return (
    <section className="bg-charcoal py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-sm font-medium tracking-widest uppercase text-primary">
          For professionals
        </p>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Keep everything you earn.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/50 leading-relaxed">
          No fees to apply. No fees ever. Get paid through escrow and build
          a verified earnings record that follows your career.
        </p>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/apply"
            className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Apply Now
          </Link>
        </div>

        {/* Quiet stats */}
        <div className="mt-16 flex items-center justify-center gap-12 text-center">
          <div>
            <p className="text-2xl font-light text-white">{totalApproved > 0 ? totalApproved : "50+"}</p>
            <p className="mt-1 text-xs text-white/30 tracking-wide uppercase">Professionals</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <p className="text-2xl font-light text-white">&lt;30%</p>
            <p className="mt-1 text-xs text-white/30 tracking-wide uppercase">Accepted</p>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div>
            <p className="text-2xl font-light text-white">{uniqueCountries > 0 ? uniqueCountries : "10"}+</p>
            <p className="mt-1 text-xs text-white/30 tracking-wide uppercase">Countries</p>
          </div>
        </div>
      </div>
    </section>
  );
}
