CREATE TABLE `collection_cards` (
	`card_key` text PRIMARY KEY NOT NULL,
	`card_json` text NOT NULL,
	`count` integer NOT NULL,
	`updated_at` text NOT NULL,
	`work_code` text NOT NULL,
	`work_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`series_code` text NOT NULL,
	`series_name` text NOT NULL,
	`color` text DEFAULT '' NOT NULL,
	`cards_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pinned_series` (
	`code` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL
);
