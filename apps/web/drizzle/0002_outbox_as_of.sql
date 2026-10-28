ALTER TABLE "memory_outbox" ADD COLUMN "as_of" date;--> statement-breakpoint
UPDATE "memory_outbox" SET "as_of" = ((substring("text" from position(E'\n' in "text") + 1))::jsonb #>> '{data,asOf}')::date WHERE "as_of" IS NULL;
