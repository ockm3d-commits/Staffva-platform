export default function WhyStaffVASection() {
  const cards = [
    {
      title: "Hear them first.",
      description: "Every profile includes two voice recordings. You know how they communicate before you spend a dollar.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
        </svg>
      ),
    },
    {
      title: "Reviewed by humans.",
      description: "Every badge is assigned by a real reviewer and permanently locked. Candidates cannot edit it.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      ),
    },
    {
      title: "Protected by escrow.",
      description: "Every payment is held before work begins. You release funds only when satisfied.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="bg-card py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <p className="text-center text-sm font-medium tracking-widest uppercase text-text-tertiary">
          Why StaffVA
        </p>
        <h2 className="mt-4 text-center text-3xl sm:text-4xl font-semibold tracking-tight text-text">
          Built different.
        </h2>

        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          {cards.map((card) => (
            <div key={card.title} className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/[0.07] text-primary">
                {card.icon}
              </div>
              <h3 className="mt-6 text-base font-semibold text-text">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">{card.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
