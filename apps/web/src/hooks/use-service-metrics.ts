import { useEffect, useRef, useState } from "react";

export type ServiceResourceMetric = {
  cpuPercent: number | null;
  memoryMb: number | null;
  extra: string | null;
};

export type MetricsSnapshot = {
  timestamp: number;
  elysia: ServiceResourceMetric;
  bullmq: ServiceResourceMetric;
  redis: ServiceResourceMetric;
  rabbitmq: ServiceResourceMetric;
  kafka: ServiceResourceMetric;
  postgres: ServiceResourceMetric;
};

function resolveApiBaseUrl(): string {
  const configured = (
    import.meta.env as Record<string, string | undefined>
  ).VITE_SERVER_URL?.trim();

  if (configured) {
    return configured;
  }

  const { hostname, protocol } = window.location;
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${protocol}//localhost:3001`;
  }

  return `${protocol}//${window.location.host}`;
}

export function useServiceMetrics(intervalMs = 2000): MetricsSnapshot | null {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const baseUrl = resolveApiBaseUrl();

    const fetch_ = async (): Promise<void> => {
      try {
        const response = await fetch(`${baseUrl}/metrics`);
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as MetricsSnapshot;
        setSnapshot(data);
      } catch {
        // network error — keep showing last known data
      }
    };

    void fetch_();
    timerRef.current = setInterval(() => {
      void fetch_();
    }, intervalMs);

    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [intervalMs]);

  return snapshot;
}
