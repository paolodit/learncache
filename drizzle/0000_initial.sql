CREATE TABLE `items` (
  `id` text PRIMARY KEY NOT NULL,
  `url` text NOT NULL,
  `canonical_url` text NOT NULL,
  `source_type` text NOT NULL,
  `title` text,
  `creator` text,
  `duration_seconds` integer,
  `thumbnail_url` text,
  `status` text NOT NULL,
  `error` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_canonical_url_unique` ON `items` (`canonical_url`);
--> statement-breakpoint
CREATE TABLE `transcripts` (
  `id` text PRIMARY KEY NOT NULL,
  `item_id` text NOT NULL,
  `source` text NOT NULL,
  `language` text,
  `text` text NOT NULL,
  `segments_json` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transcripts_item_id_unique` ON `transcripts` (`item_id`);
--> statement-breakpoint
CREATE TABLE `summaries` (
  `id` text PRIMARY KEY NOT NULL,
  `item_id` text NOT NULL,
  `model` text NOT NULL,
  `tldr` text NOT NULL,
  `key_ideas_json` text NOT NULL,
  `outline_json` text NOT NULL,
  `claims_json` text NOT NULL,
  `tags_json` text NOT NULL,
  `questions_json` text NOT NULL,
  `rendered_markdown` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `summaries_item_id_unique` ON `summaries` (`item_id`);
--> statement-breakpoint
CREATE TABLE `jobs` (
  `id` text PRIMARY KEY NOT NULL,
  `item_id` text NOT NULL,
  `type` text NOT NULL,
  `status` text NOT NULL,
  `attempts` integer NOT NULL DEFAULT 0,
  `next_run_at` integer NOT NULL,
  `error` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `jobs_due_idx` ON `jobs` (`status`, `next_run_at`);
--> statement-breakpoint
CREATE TABLE `processing_logs` (
  `id` text PRIMARY KEY NOT NULL,
  `item_id` text NOT NULL,
  `level` text NOT NULL,
  `message` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `processing_logs_item_id_idx` ON `processing_logs` (`item_id`, `created_at`);
--> statement-breakpoint
CREATE VIRTUAL TABLE `item_search` USING fts5(
  `item_id` UNINDEXED,
  `title`,
  `transcript`,
  `summary`,
  `tags`
);
