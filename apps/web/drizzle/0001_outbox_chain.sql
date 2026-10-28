ALTER TABLE "memory_outbox" ADD COLUMN "subject" text NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_outbox" ADD COLUMN "seq" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_outbox" ADD COLUMN "material_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_outbox" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "memory_outbox_chain_idx" ON "memory_outbox" USING btree ("namespace","kind","seq");--> statement-breakpoint
CREATE INDEX "memory_outbox_subject_idx" ON "memory_outbox" USING btree ("namespace","kind","subject","seq");--> statement-breakpoint
CREATE INDEX "memory_outbox_sent_idx" ON "memory_outbox" USING btree ("sent_at");