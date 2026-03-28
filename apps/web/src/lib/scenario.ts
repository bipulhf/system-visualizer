import type { SupportedScenarioId } from "~/lib/learning-content";

export function resolveScenarioFromPathname(
  pathname: string,
): SupportedScenarioId {
  if (pathname.startsWith("/scenarios/ride-sharing")) {
    return "ride-sharing";
  }

  return "flash-sale";
}
