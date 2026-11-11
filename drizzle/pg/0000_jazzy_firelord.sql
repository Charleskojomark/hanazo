CREATE TYPE "public"."batch_status" AS ENUM('sorting', 'dispatched', 'completed');--> statement-breakpoint
CREATE TYPE "public"."parcel_status" AS ENUM('pending', 'sorted', 'in_transit', 'delivered', 'failed');--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"batch_date" date NOT NULL,
	"status" "batch_status" DEFAULT 'sorting' NOT NULL,
	"total_parcels" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "district_nodes" (
	"code" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"lga" text NOT NULL,
	"district" text NOT NULL,
	"display_name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"city" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parcels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"raw_address" text NOT NULL,
	"extracted_landmark" text,
	"resolved_district_code" text,
	"assigned_bin" integer,
	"rider_id" uuid,
	"status" "parcel_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"assigned_bin" integer NOT NULL,
	"assigned_districts" text[] DEFAULT '{}' NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "batches" ADD CONSTRAINT "batches_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_resolved_district_code_district_nodes_code_fk" FOREIGN KEY ("resolved_district_code") REFERENCES "public"."district_nodes"("code") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parcels" ADD CONSTRAINT "parcels_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_hub_id_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."hubs"("id") ON DELETE cascade ON UPDATE no action;