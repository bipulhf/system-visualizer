type LogLevel = "info" | "error";

export function log(
  level: LogLevel,
  message: string,
  details?: Record<string, string | number | boolean>,
): void {
  const timestamp = new Date().toISOString();
  const detailText = details ? ` ${JSON.stringify(details)}` : "";
  const line = `[${timestamp}] [${level.toUpperCase()}] ${message}${detailText}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  console.log(line);
}
