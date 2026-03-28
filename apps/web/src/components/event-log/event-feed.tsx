import { useMemo, useState } from "react";
import { EventEntry } from "~/components/event-log/event-entry";
import { LogFilters } from "~/components/event-log/log-filters";
import {
  eventKinds,
  serviceNames,
  type EventKind,
  type ServiceName,
  type SimulationEvent,
} from "~/lib/event-types";
import { learnMoreByEventKind } from "~/lib/learning-content";

export function EventFeed({ events }: { events: SimulationEvent[] }) {
  const [activeServices, setActiveServices] = useState<ServiceName[]>([
    ...serviceNames,
  ]);
  const [activeKinds, setActiveKinds] = useState<EventKind[]>([...eventKinds]);

  const filteredEvents = useMemo(() => {
    const newestFirst = [...events].reverse();

    return newestFirst.filter((event) => {
      if (!activeServices.includes(event.source)) {
        return false;
      }

      if (!activeKinds.includes(event.kind)) {
        return false;
      }

      return true;
    });
  }, [activeKinds, activeServices, events]);

  const toggleService = (service: ServiceName): void => {
    setActiveServices((previous) => {
      if (previous.includes(service)) {
        if (previous.length === 1) {
          return previous;
        }
        return previous.filter((item) => item !== service);
      }

      return [...previous, service];
    });
  };

  const toggleKind = (kind: EventKind): void => {
    setActiveKinds((previous) => {
      if (previous.includes(kind)) {
        if (previous.length === 1) {
          return previous;
        }
        return previous.filter((item) => item !== kind);
      }

      return [...previous, kind];
    });
  };

  return (
    <section className="neo-panel bg-[var(--surface)] p-3">
      <h3 className="text-xs font-bold uppercase tracking-wider">Event Log</h3>

      <div className="mt-2">
        <LogFilters
          activeServices={activeServices}
          activeKinds={activeKinds}
          toggleService={toggleService}
          toggleKind={toggleKind}
          reset={() => {
            setActiveServices([...serviceNames]);
            setActiveKinds([...eventKinds]);
          }}
        />
      </div>

      {filteredEvents.length === 0 ? (
        <p className="mt-2 text-xs font-semibold opacity-75">
          No events match current filters.
        </p>
      ) : (
        <ul className="mt-2 max-h-64 space-y-1 overflow-auto pr-1">
          {filteredEvents.slice(0, 60).map((event) => (
            <EventEntry
              key={event.id}
              event={event}
              learnMore={event.learnMore ?? learnMoreByEventKind[event.kind]}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
