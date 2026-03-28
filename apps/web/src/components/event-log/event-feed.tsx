import { useEffect, useMemo, useState } from "react";
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

const virtualRowHeightPx = 96;
const virtualViewportHeightPx = 256;
const virtualOverscanRows = 6;

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

  const [scrollTop, setScrollTop] = useState<number>(0);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setSelectedEventId(null);
      return;
    }

    const selectedEventStillVisible = filteredEvents.some(
      (event) => event.id === selectedEventId,
    );
    if (selectedEventStillVisible) {
      return;
    }

    setSelectedEventId(filteredEvents[0]?.id ?? null);
  }, [filteredEvents, selectedEventId]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return null;
    }

    return filteredEvents.find((event) => event.id === selectedEventId) ?? null;
  }, [filteredEvents, selectedEventId]);

  const visibleWindow = useMemo(() => {
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / virtualRowHeightPx) - virtualOverscanRows,
    );
    const baseVisibleCount = Math.ceil(
      virtualViewportHeightPx / virtualRowHeightPx,
    );
    const endIndex = Math.min(
      filteredEvents.length,
      startIndex + baseVisibleCount + virtualOverscanRows * 2,
    );

    return {
      startIndex,
      endIndex,
      offsetTop: startIndex * virtualRowHeightPx,
      totalHeight: filteredEvents.length * virtualRowHeightPx,
      visibleEvents: filteredEvents.slice(startIndex, endIndex),
    };
  }, [filteredEvents, scrollTop]);

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
    <section className="card rounded-xl p-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Event Log
      </h3>

      <div className="mt-2.5">
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
        <p className="mt-3 text-xs text-[var(--muted)]">
          No events match current filters.
        </p>
      ) : (
        <>
          <div
            className="mt-2.5 max-h-64 overflow-auto"
            onScroll={(event) => {
              setScrollTop(event.currentTarget.scrollTop);
            }}
          >
            <div
              className="relative"
              style={{ height: `${visibleWindow.totalHeight}px` }}
            >
              <ul
                className="absolute left-0 right-0 space-y-0.5"
                style={{
                  transform: `translateY(${visibleWindow.offsetTop}px)`,
                }}
              >
                {visibleWindow.visibleEvents.map((event) => (
                  <EventEntry
                    key={event.id}
                    event={event}
                    selected={event.id === selectedEventId}
                    onSelect={(eventId) => {
                      setSelectedEventId(eventId);
                    }}
                  />
                ))}
              </ul>
            </div>
          </div>

          {selectedEvent ? (
            <article className="card-inset mt-2.5 rounded-lg p-2.5 text-[11px]">
              <p className="text-xs font-semibold text-[var(--muted)]">
                Event Details
              </p>
              <p className="mt-1">
                <span className="text-[var(--muted)]">Latency:</span>{" "}
                <span className="font-medium">{selectedEvent.latencyMs} ms</span>
              </p>
              <p className="mt-0.5 leading-relaxed text-[var(--muted)]">
                {selectedEvent.learnMore ??
                  learnMoreByEventKind[selectedEvent.kind]}
              </p>
              <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-all rounded-md bg-[var(--surface)] p-1.5 font-mono text-[10px]">
                {JSON.stringify(selectedEvent.data, null, 2)}
              </pre>
            </article>
          ) : null}
        </>
      )}
    </section>
  );
}
