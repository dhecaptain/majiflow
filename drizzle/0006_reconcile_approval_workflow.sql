-- Reconcile the approval workflow schema without modifying prior migration history.
ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'operations';

ALTER TABLE "public"."subscriptions"
  ADD COLUMN IF NOT EXISTS "payment_confirmed_at" timestamp with time zone;

ALTER TABLE "public"."subscriptions"
  ADD COLUMN IF NOT EXISTS "payment_reference" varchar(120);

CREATE UNIQUE INDEX IF NOT EXISTS "subscriptions_business_id_unique"
  ON "public"."subscriptions" USING btree ("business_id");
