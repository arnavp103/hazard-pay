import type { LaneSummary } from "@hazard-pay/api/contract";
import { Button, cn } from "@hazard-pay/ui";
import type { ReactNode } from "react";

import { shortHash } from "../lib/trace-format.ts";
import {
  hasActiveLaneFilter,
  LANE_KINDS,
  LANE_STATUSES,
  type LaneFilters,
} from "../lib/lane-filters.ts";

/** One toggleable filter value; clicking the active chip clears it. */
function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "hp-clip cursor-pointer border-2 px-2 py-0.5 font-data text-[10px] font-bold tracking-[0.1em] uppercase transition-colors",
        active
          ? "border-accent bg-accent text-shell"
          : "border-line bg-panel-2 text-ink-dim hover:border-accent hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 shrink-0 font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Every value of one field across the currently-loaded rows, plus the active value even if narrowed out. */
function facetValues(
  lanes: LaneSummary[],
  pick: (lane: LaneSummary) => string | null,
  active: string | undefined,
): string[] {
  const values = new Set<string>();
  for (const lane of lanes) {
    const value = pick(lane);
    if (value !== null) {
      values.add(value);
    }
  }
  if (active !== undefined) {
    values.add(active);
  }
  return Array.from(values).sort();
}

export interface LaneFilterBarProps {
  filters: LaneFilters;
  /** The currently-loaded (already-filtered) rows — the source of the leader/model/config facets. */
  lanes: LaneSummary[];
  onToggle: <K extends keyof LaneFilters>(key: K, value: NonNullable<LaneFilters[K]>) => void;
  onClear: () => void;
}

/**
 * Filter chips for the lane index (#58): `kind`/`status` are the fixed
 * runtime vocab (CONTEXT.md), always shown in full so a filter never hides
 * its own siblings; `leader`/`model`/`configHash` are open-ended, so their
 * options are the distinct values seen in the currently-loaded rows — a
 * simple faceted-search approximation where one filter can narrow another's
 * options (picking a leader can hide a model only that leader never used).
 * The active value is always kept in its own option even when narrowed out,
 * so a chip never disappears out from under the filter it represents.
 */
export function LaneFilterBar({ filters, lanes, onToggle, onClear }: LaneFilterBarProps) {
  const leaders = facetValues(lanes, (lane) => lane.leaderName, filters.leader);
  const models = facetValues(lanes, (lane) => lane.model, filters.model);
  const configHashes = facetValues(lanes, (lane) => lane.configHash, filters.configHash);

  return (
    <div className="flex flex-col gap-2.5 border-2 border-line bg-panel-2 px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <FilterGroup label="kind">
          {LANE_KINDS.map((kind) => (
            <FilterChip
              key={kind}
              label={kind}
              active={filters.kind === kind}
              onClick={() => onToggle("kind", kind)}
            />
          ))}
        </FilterGroup>
        <FilterGroup label="status">
          {LANE_STATUSES.map((status) => (
            <FilterChip
              key={status}
              label={status}
              active={filters.status === status}
              onClick={() => onToggle("status", status)}
            />
          ))}
        </FilterGroup>
        {leaders.length > 0 && (
          <FilterGroup label="leader">
            {leaders.map((leader) => (
              <FilterChip
                key={leader}
                label={leader}
                active={filters.leader === leader}
                onClick={() => onToggle("leader", leader)}
              />
            ))}
          </FilterGroup>
        )}
        {models.length > 0 && (
          <FilterGroup label="model">
            {models.map((model) => (
              <FilterChip
                key={model}
                label={model}
                active={filters.model === model}
                onClick={() => onToggle("model", model)}
              />
            ))}
          </FilterGroup>
        )}
        {configHashes.length > 0 && (
          <FilterGroup label="config">
            {configHashes.map((hash) => (
              <FilterChip
                key={hash}
                label={shortHash(hash)}
                active={filters.configHash === hash}
                onClick={() => onToggle("configHash", hash)}
              />
            ))}
          </FilterGroup>
        )}
      </div>
      {hasActiveLaneFilter(filters) && (
        <Button variant="ghost" size="sm" className="self-start" onClick={onClear}>
          clear filters
        </Button>
      )}
    </div>
  );
}
