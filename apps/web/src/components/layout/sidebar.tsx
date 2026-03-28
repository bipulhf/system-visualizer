const phases = ["The Spike", "Job Queuing", "Fan-Out", "Audit Trail"];

export function Sidebar() {
  return (
    <aside className="neo-panel flex h-full flex-col gap-4 bg-[var(--background)] p-4">
      <section className="space-y-2">
        <h2 className="text-lg font-black tracking-tight">Scenario Info</h2>
        <p className="text-sm leading-relaxed">
          Understand how distributed services cooperate in a high-pressure flash
          sale.
        </p>
      </section>

      <section className="neo-panel bg-white/70 p-3 dark:bg-black/30">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          The Problem
        </h3>
        <p className="mt-2 text-sm">
          Ten thousand customers attempt to buy one hundred items in seconds.
        </p>
      </section>

      <section className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Phase Timeline
        </h3>
        <ol className="space-y-2">
          {phases.map((phase, index) => (
            <li key={phase} className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center border-2 border-[var(--border)] bg-[var(--main)] text-xs font-black shadow-[var(--shadow)]">
                {index + 1}
              </span>
              <span className="text-sm font-semibold">{phase}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Learning Panel
        </h3>
        <div className="neo-panel bg-white/70 p-3 dark:bg-black/30">
          <p className="text-sm">Why this tech?</p>
          <p className="mt-1 text-xs opacity-80">
            Redis keeps stock decrements atomic under extreme contention.
          </p>
        </div>
      </section>
    </aside>
  );
}
