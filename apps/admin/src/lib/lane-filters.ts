import type { LaneListFilter } from "@hazard-pay/api/contract";

/**
 * The `/lanes` index's filter state (#58) — the same shape `GET /lanes`
 * accepts, so a filter object round-trips straight into `api.lanes.list`
 * with no re-mapping. The URL is the source of truth (TanStack Router's
 * `validateSearch`), which is what makes a filtered view survive a reload
 * and stay shareable — the actual admin workflow this exists for.
 */
export type LaneFilters = LaneListFilter;

export const LANE_KINDS = ["foreground", "mission"] as const;
export const LANE_STATUSES = ["open", "waking", "closed"] as const;

export const LANE_FILTER_KEYS = [
  "leader",
  "kind",
  "status",
  "configHash",
  "model",
] as const satisfies readonly (keyof LaneFilters)[];

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
}

/**
 * `createFileRoute("/lanes/")`'s `validateSearch`. Every key is omitted
 * rather than set to `undefined` when absent/invalid — TanStack Router
 * persists exactly what comes back, and an `undefined`-valued key would
 * otherwise ride along into the query string the api client builds.
 */
export function validateLaneSearch(search: Record<string, unknown>): LaneFilters {
  const leader = readString(search.leader);
  const kind = readEnum(search.kind, LANE_KINDS);
  const status = readEnum(search.status, LANE_STATUSES);
  const configHash = readString(search.configHash);
  const model = readString(search.model);
  return {
    ...(leader !== undefined && { leader }),
    ...(kind !== undefined && { kind }),
    ...(status !== undefined && { status }),
    ...(configHash !== undefined && { configHash }),
    ...(model !== undefined && { model }),
  };
}

export function hasActiveLaneFilter(filters: LaneFilters): boolean {
  return LANE_FILTER_KEYS.some((key) => filters[key] !== undefined);
}
