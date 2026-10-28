CREATE TABLE "profiles" (
	"address" text PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "added_by" uuid;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "kind" text DEFAULT 'flat' NOT NULL;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "place" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "invite_code" text;--> statement-breakpoint
ALTER TABLE "groups" ADD COLUMN "created_by" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_added_by_members_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "members_group_address_idx" ON "members" USING btree ("group_id","sui_address");--> statement-breakpoint
CREATE INDEX "members_address_idx" ON "members" USING btree ("sui_address");--> statement-breakpoint
ALTER TABLE "groups" ADD CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code");