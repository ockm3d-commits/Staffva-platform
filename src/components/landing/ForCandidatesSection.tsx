import Link from "next/link";

interface Props {
  totalApproved: number;
  uniqueCountries: number;
}

export default function ForCandidatesSection({ totalApproved: _totalApproved, uniqueCountries: _uniqueCountries }: Props) {
  return (
    <section className="bg-charcoal py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <p className="text-sm font-medium tracking-widest uppercase text-primary">
          For professionals
        </p>
        <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Your voice is your resume.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg text-white/50 leading-relaxed">
          Record two short samples. Our team reviews them. If you pass,
          clients can hear you before they reach out — and you keep
          every dollar you earn.
        </p>

        <div className="mt-10">
          <Link
            href="/apply"
            className="rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors"
          >
            Start your application
          </Link>
        </div>
      </div>
    </section>
  );
}
