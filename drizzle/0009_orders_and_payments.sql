CREATE TABLE "orders" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(160),
	"order_number" varchar(24) NOT NULL,
	"business_id" varchar(180) NOT NULL,
	"customer_user_id" varchar(80),
	"customer_phone" varchar(20),
	"status" varchar(24) NOT NULL,
	"rider_token_hash" varchar(64),
	"placed_at" timestamp with time zone NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(80) PRIMARY KEY NOT NULL,
	"idempotency_key" varchar(240) NOT NULL,
	"checkout_request_id" varchar(120),
	"status" varchar(16) NOT NULL,
	"order_ids" text[] NOT NULL,
	"refund_ids" text[] NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_unique" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_unique" ON "orders" USING btree ("order_number");--> statement-breakpoint
CREATE INDEX "orders_business_id_idx" ON "orders" USING btree ("business_id","placed_at");--> statement-breakpoint
CREATE INDEX "orders_customer_user_id_idx" ON "orders" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "orders_customer_phone_idx" ON "orders" USING btree ("customer_phone");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "orders_rider_token_hash_idx" ON "orders" USING btree ("rider_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_key_unique" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_checkout_request_id_unique" ON "payments" USING btree ("checkout_request_id");--> statement-breakpoint
CREATE INDEX "payments_order_ids_idx" ON "payments" USING gin ("order_ids");--> statement-breakpoint
CREATE INDEX "payments_refund_ids_idx" ON "payments" USING gin ("refund_ids");