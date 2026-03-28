import { Button } from "~/components/ui/button";
import {
  eventKinds,
  serviceNames,
  type EventKind,
  type ServiceName,
} from "~/lib/event-types";

export function LogFilters({
  activeServices,
  activeKinds,
  toggleService,
  toggleKind,
  reset,
}: {
  activeServices: ServiceName[];
  activeKinds: EventKind[];
  toggleService: (service: ServiceName) => void;
  toggleKind: (kind: EventKind) => void;
  reset: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-black uppercase tracking-wide">
          Filters
        </p>
        <Button size="sm" variant="ghost" type="button" onClick={reset}>
          Reset
        </Button>
      </div>

      <div className="flex flex-wrap gap-1">
        {serviceNames.map((service) => {
          const active = activeServices.includes(service);

          return (
            <button
              key={service}
              type="button"
              onClick={() => {
                toggleService(service);
              }}
              className={`neo-panel px-2 py-1 text-[11px] font-bold uppercase ${active ? "bg-[var(--main)] text-[var(--background)]" : "bg-[var(--background)]"}`}
            >
              {service}
            </button>
          );
        })}
      </div>

      <div className="max-h-20 overflow-auto">
        <div className="flex flex-wrap gap-1">
          {eventKinds.map((kind) => {
            const active = activeKinds.includes(kind);

            return (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  toggleKind(kind);
                }}
                className={`neo-panel px-2 py-1 text-[10px] font-bold ${active ? "bg-[var(--foreground)] text-[var(--background)]" : "bg-[var(--background)]"}`}
              >
                {kind}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
