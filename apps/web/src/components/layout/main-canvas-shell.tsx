const services = [
  "Elysia API",
  "Redis",
  "BullMQ",
  "RabbitMQ",
  "Kafka",
  "PostgreSQL",
];

export function MainCanvasShell() {
  return (
    <section className="neo-panel grid min-h-[60dvh] grid-rows-[1fr,auto,auto] gap-3 bg-[var(--background)] p-3">
      <div className="neo-panel relative overflow-hidden bg-[var(--surface)] p-4">
        <div className="absolute -top-16 right-8 h-40 w-40 rounded-full bg-[var(--main)]/25 blur-2xl" />
        <div className="absolute -bottom-14 left-8 h-32 w-32 rounded-full bg-[var(--rabbitmq)]/35 blur-2xl" />
        <h2 className="text-base font-black uppercase tracking-wide">
          Architecture Flow Canvas
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service}
              className="neo-panel bg-[var(--background)] p-3"
            >
              <p className="text-sm font-bold">{service}</p>
              <p className="mt-2 text-xs opacity-80">Status: idle</p>
            </article>
          ))}
        </div>
      </div>

      <div className="neo-panel bg-[var(--surface)] p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Activity Monitor
        </h3>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {services.map((service) => (
            <div
              key={service}
              className="neo-panel bg-[var(--background)] px-2 py-1 text-xs font-semibold"
            >
              {service}
            </div>
          ))}
        </div>
      </div>

      <div className="neo-panel bg-[var(--surface)] p-3">
        <h3 className="text-xs font-bold uppercase tracking-wider">
          Event Log
        </h3>
        <ul className="mt-2 space-y-1 text-xs">
          <li className="neo-panel bg-[var(--background)] px-2 py-1">
            00:00.012 request.received -&gt; elysia
          </li>
          <li className="neo-panel bg-[var(--background)] px-2 py-1">
            00:00.016 redis.op -&gt; DECR stock:item_42
          </li>
          <li className="neo-panel bg-[var(--background)] px-2 py-1">
            00:00.031 bullmq.job.created -&gt; order_901
          </li>
        </ul>
      </div>
    </section>
  );
}
