export default function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Browse instantly",
      description: "No login. No subscription. Profiles load the moment you arrive.",
    },
    {
      number: "02",
      title: "Listen, then decide",
      description: "Two voice recordings on every profile. An oral reading and a personal introduction.",
    },
    {
      number: "03",
      title: "Pay through escrow",
      description: "Funds are held until you approve the work. Protected on both sides.",
    },
  ];

  return (
    <section className="bg-background py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-center text-sm font-medium tracking-widest uppercase text-text-tertiary">
          How it works
        </p>
        <h2 className="mt-4 text-center text-3xl sm:text-4xl font-semibold tracking-tight text-text">
          From search to hire in minutes.
        </h2>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-8">
          {steps.map((step) => (
            <div key={step.number} className="text-center">
              <p className="text-5xl font-extralight tracking-tight text-text/10">
                {step.number}
              </p>
              <h3 className="mt-4 text-lg font-semibold text-text">{step.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
