CREATE TABLE "leader_note" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "leader_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"lane_id" uuid NOT NULL,
	"leader_name" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leader_note" ADD CONSTRAINT "leader_note_lane_id_lane_id_fk" FOREIGN KEY ("lane_id") REFERENCES "public"."lane"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "leader_note_lane_id_idx" ON "leader_note" USING btree ("lane_id");