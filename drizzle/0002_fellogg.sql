CREATE TABLE `error_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`route_type` text,
	`digest` text,
	`message` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `error_created` ON `error_log` (`created_at`);
