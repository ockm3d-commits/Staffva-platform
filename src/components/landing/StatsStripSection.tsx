const STATS = [
  { number: "<30%", label: "Accepted" },
  { number: "100%", label: "Human-reviewed" },
  { number: "2", label: "Voice recordings per profile" },
  { number: "10+", label: "Countries" },
];

export default function StatsStripSection() {
  return (
    <section className="border-y border-border-light bg-card">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-border-light">
          {STATS.map((stat) => (
            <div key={stat.number} className="flex flex-col items-center py-10 px-4">
              <p className="text-3xl sm:text-4xl font-light tracking-tight text-text">
                {stat.number}
              </p>
              <p className="mt-2 text-xs text-text-tertiary tracking-wide uppercase">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
