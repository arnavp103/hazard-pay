CREATE INDEX "lane_leader_name_idx" ON "lane" USING btree ("leader_name");--> statement-breakpoint
CREATE INDEX "lane_config_hash_idx" ON "lane" USING btree ("config_hash");--> statement-breakpoint
CREATE INDEX "lane_event_model_turn_idx" ON "lane_event" USING btree ("lane_id","seq") WHERE "lane_event"."type" = 'model_turn';