ALTER TABLE "subscriptions" ADD COLUMN "status" varchar(20) DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "confirmation_token" varchar(255);--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "token_expires_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_confirmation_token_idx" ON "subscriptions" USING btree ("confirmation_token");