import { Button } from "~/components/ui/button";
import {
  eventKinds,
  serviceNames,
  type EventKind,
  type ServiceName,
} from "~/lib/event-types";
import { cn } from "~/lib/utils";

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
        <p className="text-xs font-semibold text-[var(--muted)]">Filters</p>
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
              aria-pressed={active}
              onClick={() => {
                toggleService(service);
              }}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                active
                  ? "bg-[var(--main)] text-white"
                  : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
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
                aria-pressed={active}
                onClick={() => {
                  toggleKind(kind);
                }}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
                  active
                    ? "bg-[var(--foreground)] text-[var(--surface)]"
                    : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
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
