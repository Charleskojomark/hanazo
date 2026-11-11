CREATE TABLE `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`hub_id` text NOT NULL,
	`batch_date` text NOT NULL,
	`status` text DEFAULT 'sorting' NOT NULL,
	`total_parcels` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`hub_id`) REFERENCES `hubs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `district_nodes` (
	`code` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`lga` text NOT NULL,
	`district` text NOT NULL,
	`display_name` text NOT NULL,
	`aliases` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hubs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `parcels` (
	`id` text PRIMARY KEY NOT NULL,
	`batch_id` text NOT NULL,
	`raw_address` text NOT NULL,
	`extracted_landmark` text,
	`resolved_district_code` text,
	`assigned_bin` integer,
	`rider_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`batch_id`) REFERENCES `batches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resolved_district_code`) REFERENCES `district_nodes`(`code`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`rider_id`) REFERENCES `riders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `riders` (
	`id` text PRIMARY KEY NOT NULL,
	`hub_id` text NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`assigned_bin` integer NOT NULL,
	`assigned_districts` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`hub_id`) REFERENCES `hubs`(`id`) ON UPDATE no action ON DELETE cascade
);
