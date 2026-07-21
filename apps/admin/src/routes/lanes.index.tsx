import { ListRow, ListRowGroup, Panel } from "@hazard-pay/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { api } from "../lib/api.ts";
import { formatTime, laneTitle, shortHash, shortId } from "../lib/trace-format.ts";

export const Route = createFileRoute("/lanes/")({
  component: LanesScreen,
});

/**
 * The lane index (#24): every lane the runtime has written, with per-type
 * lane event tallies, straight from `GET /lanes`. Real data or an honest
 * empty state — never canned rows on this screen.
 */
function LanesScreen() {
  const navigate = useNavigate();
  const { data, error } = useQuery({
    queryKey: ["admin", "lanes"],
    queryFn: () => api.lanes.list(),
    refetchInterval: 15_000,
  });

  return (
    <main className="hp-noise min-h-screen p-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-7">
        <header className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-4xl leading-none font-extrabold tracking-[0.06em] text-ink uppercase">
              Lanes
            </h1>
            <p className="mt-1 font-data text-[10px] tracking-[0.1em] text-ink-dim uppercase">
              /// lane index · every thread of every leader
            </p>
          </div>
          <Link
            to="/"
            className="font-data text-[10px] font-bold tracking-[0.1em] text-accent uppercase underline decoration-dashed underline-offset-4 hover:text-accent-2"
          >
            ← admin
          </Link>
        </header>

        {error !== null && (
          <Panel title="API unreachable" tone="magenta">
            <p className="font-data text-[11px] leading-relaxed text-ink-dim">
              Could not reach apps/api through the dev proxy. Start it with
              {" "}
              <code className="bg-panel-2 px-1 text-ink">pnpm --filter @hazard-pay/api dev</code>
              {" "}
              (dev Postgres up first:
              {" "}
              <code className="bg-panel-2 px-1 text-ink">pnpm db:up</code>
              ).
            </p>
          </Panel>
        )}

        {data !== undefined && data.lanes.length === 0 && (
          <Panel title="No lanes yet" meta="empty database">
            <div className="flex flex-col gap-2 font-data text-[11px] leading-relaxed text-ink-dim">
              <p>
                This database has no lane logs — the agent runtime has never run
                against it. Generate a real one:
              </p>
              <code className="self-start bg-panel-2 px-2 py-1 text-ink">
                pnpm --filter @hazard-pay/agent smoke
              </code>
              <p>
                (one hello-leader wake against Gemini; needs
                {" "}
                <code className="bg-panel-2 px-1 text-ink">GEMINI_API_KEY</code>
                {" "}
                in
                {" "}
                <code className="bg-panel-2 px-1 text-ink">.env</code>
                , and writes to its own clone — point it at this database or
                wake a lane through apps/api to see rows here).
              </p>
            </div>
          </Panel>
        )}

        {data !== undefined && data.lanes.length > 0 && (
          <Panel title="Lanes" meta={`${data.lanes.length} lanes · polling 15s`} flush>
            <ListRowGroup>
              {data.lanes.map((lane, index) => (
                <ListRow
                  key={lane.id}
                  status={lane.status === "closed" ? "closed" : "running"}
                  index={String(index + 1).padStart(2, "0")}
                  title={laneTitle(lane)}
                  meta={`lane ${shortId(lane.id)} · cfg ${shortHash(lane.configHash)} · ${lane.status}${lane.lastEventAt === null ? "" : ` · last ${formatTime(lane.lastEventAt)}`}`}
                  trailing={`${lane.eventCounts.total} lane events · ${lane.eventCounts.modelTurn} turns`}
                  onClick={() => void navigate({ to: "/lanes/$laneId", params: { laneId: lane.id } })}
                />
              ))}
            </ListRowGroup>
          </Panel>
        )}
      </div>
    </main>
  );
}
