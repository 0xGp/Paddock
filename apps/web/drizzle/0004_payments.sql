CREATE TABLE "payments" (
	"digest" text PRIMARY KEY NOT NULL,
	"group_key" text NOT NULL,
	"from_member" text NOT NULL,
	"to_member" text NOT NULL,
	"from_address" text NOT NULL,
	"to_address" text NOT NULL,
	"micro_usdc" bigint NOT NULL,
	"amount_minor" bigint NOT NULL,
	"coin_type" text NOT NULL,
	"checkpoint" bigint,
	"settled_at" timestamp with time zone NOT NULL,
	"confirm_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_links" (
	"address" text PRIMARY KEY NOT NULL,
	"group_key" text NOT NULL,
	"member_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "payments_group_idx" ON "payments" USING btree ("group_key","settled_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_links_member_idx" ON "wallet_links" USING btree ("group_key","member_key");