CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key_hash" varchar(64) NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner" varchar(255) NOT NULL,
	"repo" varchar(255) NOT NULL,
	"last_seen_tag" varchar(255),
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"owner" varchar(255) NOT NULL,
	"repo" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_owner_repo_idx" ON "repositories" USING btree ("owner","repo");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_email_owner_repo_idx" ON "subscriptions" USING btree ("email","owner","repo");--> statement-breakpoint
CREATE INDEX "subscriptions_owner_repo_idx" ON "subscriptions" USING btree ("owner","repo");