-- Phone-first accounts: a customer can sign in with an SMS code and never
-- set an email or a password, and a phone number belongs to one account.
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_phone_unique" ON "users" USING btree ("phone");--> statement-breakpoint
-- The customer's last fulfilment choice and last station, so the next order
-- starts where they left off.
ALTER TABLE "customer_preferences" ADD COLUMN "fulfilment" varchar(10);--> statement-breakpoint
ALTER TABLE "customer_preferences" ADD COLUMN "last_station_id" varchar(180);--> statement-breakpoint
-- One-time sign-in codes. Only a hash of the code is stored.
CREATE TABLE "auth_otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code_hash" varchar(64) NOT NULL,
	"purpose" varchar(16) NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "auth_otp_codes_phone_purpose_idx" ON "auth_otp_codes" USING btree ("phone","purpose");
