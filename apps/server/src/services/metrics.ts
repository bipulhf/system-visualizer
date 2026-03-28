import { getRabbitMqManagementStats } from "./rabbitmq";
import { getRedisInfoSection } from "./redis";
import { getPostgresResourceStats } from "./postgres";

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

let prevNodeCpuUsage: NodeJS.CpuUsage | null = null;
let prevNodeHrtime: bigint | null = null;
let prevRedisCpuTotal: number | null = null;
let prevRedisCpuSampleTime: number | null = null;

function collectNodeCpuPercent(): number {
  const now = process.hrtime.bigint();
  const usage = process.cpuUsage();

  if (prevNodeCpuUsage !== null && prevNodeHrtime !== null) {
    const elapsedNs = Number(now - prevNodeHrtime);
    const usedMicros =
      usage.user - prevNodeCpuUsage.user + (usage.system - prevNodeCpuUsage.system);
    prevNodeCpuUsage = usage;
    prevNodeHrtime = now;
    const percent = (usedMicros / (elapsedNs / 1000)) * 100;
    return Math.min(100, Math.max(0, Math.round(percent * 10) / 10));
  }

  prevNodeCpuUsage = usage;
  prevNodeHrtime = now;
  return 0;
}

async function collectRedisMetrics(): Promise<ServiceResourceMetric> {
  try {
    const [memInfo, cpuInfo] = await Promise.all([
      getRedisInfoSection("memory"),
      getRedisInfoSection("cpu"),
    ]);

    const memMatch = memInfo.match(/used_memory:(\d+)/);
    const memBytes = memMatch ? Number(memMatch[1]) : 0;
    const memoryMb = Math.round((memBytes / 1024 / 1024) * 10) / 10;

    const userMatch = cpuInfo.match(/used_cpu_user:([\d.]+)/);
    const sysMatch = cpuInfo.match(/used_cpu_sys:([\d.]+)/);
    const cpuTotal =
      (userMatch ? Number(userMatch[1]) : 0) + (sysMatch ? Number(sysMatch[1]) : 0);

    let cpuPercent: number | null = null;
    const now = Date.now();

    if (prevRedisCpuTotal !== null && prevRedisCpuSampleTime !== null) {
      const elapsedMs = now - prevRedisCpuSampleTime;
      if (elapsedMs > 0) {
        const delta = cpuTotal - prevRedisCpuTotal;
        cpuPercent = Math.min(100, Math.round((delta / (elapsedMs / 1000)) * 100 * 10) / 10);
      }
    }

    prevRedisCpuTotal = cpuTotal;
    prevRedisCpuSampleTime = now;

    return { cpuPercent, memoryMb, extra: null };
  } catch {
    return { cpuPercent: null, memoryMb: null, extra: null };
  }
}

async function collectRabbitMqMetrics(): Promise<ServiceResourceMetric> {
  const stats = await getRabbitMqManagementStats();
  if (!stats) {
    return { cpuPercent: null, memoryMb: null, extra: null };
  }
  return { cpuPercent: null, memoryMb: stats.memUsedMb, extra: null };
}

async function collectPostgresMetrics(): Promise<ServiceResourceMetric> {
  try {
    const stats = await getPostgresResourceStats();
    return {
      cpuPercent: null,
      memoryMb: stats.dbSizeMb,
      extra: `${stats.activeConnections} active conn`,
    };
  } catch {
    return { cpuPercent: null, memoryMb: null, extra: null };
  }
}

export async function collectMetricsSnapshot(): Promise<MetricsSnapshot> {
  const nodeCpu = collectNodeCpuPercent();
  const nodeMem = process.memoryUsage();
  const rssMemMb = Math.round((nodeMem.rss / 1024 / 1024) * 10) / 10;

  const [redisResult, rabbitResult, postgresResult] = await Promise.allSettled([
    collectRedisMetrics(),
    collectRabbitMqMetrics(),
    collectPostgresMetrics(),
  ]);

  const unwrap = (
    result: PromiseSettledResult<ServiceResourceMetric>,
  ): ServiceResourceMetric => {
    return result.status === "fulfilled"
      ? result.value
      : { cpuPercent: null, memoryMb: null, extra: null };
  };

  const nodeMetric: ServiceResourceMetric = {
    cpuPercent: nodeCpu,
    memoryMb: rssMemMb,
    extra: null,
  };

  return {
    timestamp: Date.now(),
    elysia: nodeMetric,
    bullmq: nodeMetric,
    redis: unwrap(redisResult),
    rabbitmq: unwrap(rabbitResult),
    kafka: { cpuPercent: null, memoryMb: null, extra: null },
    postgres: unwrap(postgresResult),
  };
}
