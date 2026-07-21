-- Agent-runtime tables (ADR 0003): the append-only lane event log IS the
-- checkpoint layer; no separate step-checkpoint tables exist.
--
-- Row shape per the framework-survey recommendation (research/agent-framework-
-- survey): lane_event = (lane_id, seq, author, type, payload jsonb,
-- occurred_at) with PRIMARY KEY (lane_id, seq) as the optimistic append guard
-- — concurrent appenders computing the same next seq race, the loser gets a
-- unique violation, and each lane's log stays gapless and totally ordered.
-- `payload` is a versioned envelope owned by @hazard-pay/agent, never
-- provider-raw JSON; `type` in (input, model_turn, tool_result, compaction).
-- `compaction` is a RESERVED type (schema only), as are the lane columns
-- forked_from_lane_id/forked_from_seq — the forking seam (ADR 0003 §4).
--
-- `lane.status` is the wake claim (open -> waking guarded update, stamping
-- woke_at; closed is terminal); one foreground lane per leader is enforced by
-- the partial unique index below. leader_config stores each config JSON once,
-- keyed by content hash; lanes stamp config_hash for trace comparison.
CREATE TABLE "lane" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"leader_name" text NOT NULL,
	"config_hash" text NOT NULL,
	"parent_lane_id" uuid,
	"status" text DEFAULT 'open' NOT NULL,
	"woke_at" timestamp with time zone,
	"forked_from_lane_id" uuid,
	"forked_from_seq" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lane_event" (
	"lane_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"author" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lane_event_lane_id_seq_pk" PRIMARY KEY("lane_id","seq")
);
--> statement-breakpoint
CREATE TABLE "leader_config" (
	"hash" text PRIMARY KEY NOT NULL,
	"config" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lane" ADD CONSTRAINT "lane_config_hash_leader_config_hash_fk" FOREIGN KEY ("config_hash") REFERENCES "public"."leader_config"("hash") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lane" ADD CONSTRAINT "lane_parent_lane_id_lane_id_fk" FOREIGN KEY ("parent_lane_id") REFERENCES "public"."lane"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lane_event" ADD CONSTRAINT "lane_event_lane_id_lane_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lane"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lane_parent_lane_id_idx" ON "lane" USING btree ("parent_lane_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lane_one_foreground_per_leader_idx" ON "lane" USING btree ("leader_name") WHERE "lane"."kind" = 'foreground';