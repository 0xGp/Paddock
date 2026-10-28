CREATE TABLE "memory_snapshots" (
	"namespace" text PRIMARY KEY NOT NULL,
	"recalled" jsonb NOT NULL,
	"recalled_at" timestamp with time zone NOT NULL,
	"recall_ms" integer NOT NULL,
	"relayer_count" integer,
	"degraded" boolean DEFAULT false NOT NULL,
	"error" text,
	"attempted_at" timestamp with time zone NOT NULL
);
