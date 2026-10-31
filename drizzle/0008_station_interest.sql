CREATE TABLE "station_interest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"phone" varchar(20),
	"area" varchar(120),
	"latitude" double precision,
	"longitude" double precision,
	"business_id" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "station_interest" ADD CONSTRAINT "station_interest_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "station_interest_phone_idx" ON "station_interest" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "station_interest_area_idx" ON "station_interest" USING btree ("area");