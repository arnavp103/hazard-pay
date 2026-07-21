-- Walking-skeleton rows predate tick_number and carry no meaning; clear them
-- so the NOT NULL column can land on databases that already ticked.
TRUNCATE TABLE "tick";--> statement-breakpoint
ALTER TABLE "tick" ADD COLUMN "tick_number" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "tick" ADD COLUMN "traceparent" text;--> statement-breakpoint
ALTER TABLE "tick" ADD CONSTRAINT "tick_tick_number_unique" UNIQUE("tick_number");
