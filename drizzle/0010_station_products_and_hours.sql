CREATE TABLE "business_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500) NOT NULL,
	"category" varchar(24) NOT NULL,
	"unit" varchar(24) NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"old_price" numeric(10, 2),
	"stock" integer DEFAULT 0 NOT NULL,
	"stock_low" integer DEFAULT 10 NOT NULL,
	"image" varchar(24) DEFAULT 'bottle' NOT NULL,
	"popular" boolean DEFAULT false NOT NULL,
	"options" jsonb,
	"is_visible" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "opening_hours" jsonb;--> statement-breakpoint
ALTER TABLE "businesses" ADD COLUMN "free_delivery_above" numeric(10, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "business_products" ADD CONSTRAINT "business_products_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_products_business_id_idx" ON "business_products" USING btree ("business_id","sort_order");