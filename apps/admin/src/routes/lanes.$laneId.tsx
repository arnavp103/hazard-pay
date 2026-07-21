import { Button, Panel, StatReadout, StatusChip } from "@hazard-pay/ui";
import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { LaneEventChip } from "../components/lane-event-chip.tsx";
import { api } from "../lib/api.ts";
import { formatTime, laneTitle, shortHash, shortId } from "../lib/trace-format.ts";

export const Route = createFileRoute("/lanes/$laneId")({
  component: LaneTraceScreen,
});

/**
 * The transcript view (#24): one lane's full log as progressive-disclosure
 * chips — summaries by default, one deep-dive at a time (#11 rider).
 * Overworld-tier polling: the `seq > lastSeen` cursor rides the infinite
 * query's pages; no realtime transport (per the ticket).
 */
function LaneTraceScreen() {
  const { laneId } = Route.useParams();
  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["admin", "lanes", laneId, "trace"],
    queryFn: ({ pageParam }) => api.lanes.events({ laneId, after: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.events.at(-1)?.seq ?? null : null,
    refetchInterval: 5_000,
    retry: (failureCount, err) =>
      // A 404 is an answer (no such lane), not a flake — don't retry it.
      failureCount < 1 && !(err instanceof Error && err.message.includes("no lane")),
  });

  const pages = data?.pages ?? [];
  const lane = pages.at(-1)?.lane;
  const events = pages.flatMap((page) => page.events);

  return (
    <main className="hp-noise min-h-screen p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
              Lane
              <span className="ml-3 text-ink-dim">{shortId(laneId)}</span>
            </h1>
            <p className="mt-1 font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
              /// transcript · seq-ordered lane events · poll 5s
            </p>
          </div>
          <Link
            to="/lanes"
            className="font-data text-[10px] font-bold tracking-[0.1em] text-accent uppercase underline decoration-dashed underline-offset-4 hover:text-accent-2"
          >
            ← lane index
          </Link>
        </header>

        {error !== null && (
          <Panel title="Lane unavailable" tone="magenta">
            <p className="font-data text-[11px] leading-relaxed text-ink-dim">
              {error.message.includes("no lane")
                ? `No lane ${laneId} in this database.`
                : "Could not reach apps/api through the dev proxy — is `pnpm --filter @hazard-pay/api dev` running?"}
            </p>
          </Panel>
        )}

        {lane !== undefined && (
          <>
            <Panel
              title={laneTitle(lane)}
              meta={(
                <span className="inline-flex items-center gap-2">
                  <StatusChip tone={lane.kind === "foreground" ? "info" : "magenta"}>{lane.kind}</StatusChip>
                  <StatusChip tone={lane.status === "closed" ? "neutral" : "acid"} stamped>
                    {lane.status}
                  </StatusChip>
                </span>
              )}
            >
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
                  <StatReadout label="Lane events" value={String(lane.eventCounts.total)} />
                  <StatReadout label="Inputs" value={String(lane.eventCounts.input)} />
                  <StatReadout label="Model turns" value={String(lane.eventCounts.modelTurn)} />
                  <StatReadout label="Tool results" value={String(lane.eventCounts.toolResult)} />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t-2 border-dashed border-line pt-3 font-data text-[10px]">
                  <dt className="tracking-[0.08em] text-ink-dim uppercase">lane id</dt>
                  <dd className="wrap-anywhere text-ink tabular-nums">{lane.id}</dd>
                  <dt className="tracking-[0.08em] text-ink-dim uppercase">leader</dt>
                  <dd className="text-ink">{lane.leaderName}</dd>
                  <dt className="tracking-[0.08em] text-ink-dim uppercase">config</dt>
                  <dd className="text-ink tabular-nums" title={lane.configHash}>
                    {shortHash(lane.configHash)}
                    …
                  </dd>
                  <dt className="tracking-[0.08em] text-ink-dim uppercase">created</dt>
                  <dd className="text-ink tabular-nums">{formatTime(lane.createdAt)}</dd>
                  {lane.wokeAt !== null && (
                    <>
                      <dt className="tracking-[0.08em] text-ink-dim uppercase">last wake claim</dt>
                      <dd className="text-ink tabular-nums">{formatTime(lane.wokeAt)}</dd>
                    </>
                  )}
                  {lane.parentLaneId !== null && (
                    <>
                      <dt className="tracking-[0.08em] text-ink-dim uppercase">parent lane</dt>
                      <dd>
                        <Link
                          to="/lanes/$laneId"
                          params={{ laneId: lane.parentLaneId }}
                          className="text-accent underline decoration-dashed underline-offset-2 hover:text-accent-2"
                        >
                          {shortId(lane.parentLaneId)}
                          …
                        </Link>
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            </Panel>

            <Panel
              title="Trace"
              tone="magenta"
              meta={`${events.length} of ${lane.eventCounts.total} lane events · newest last`}
            >
              <div className="flex flex-col gap-2">
                {events.length === 0 && (
                  <p className="font-data text-[11px] text-ink-dim">
                    Log is empty — this lane has no lane events yet.
                  </p>
                )}
                {events.map((record) => (
                  <LaneEventChip key={record.seq} record={record} />
                ))}
                {hasNextPage && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start"
                    disabled={isFetchingNextPage}
                    onClick={() => void fetchNextPage()}
                  >
                    {isFetchingNextPage ? "loading…" : "load next page"}
                  </Button>
                )}
              </div>
            </Panel>
          </>
        )}

        {error === null && lane === undefined && (
          <span className="hp-blink font-data text-xs tracking-[0.2em] text-ink-dim uppercase">
            folding lane…
          </span>
        )}
      </div>
    </main>
  );
}
