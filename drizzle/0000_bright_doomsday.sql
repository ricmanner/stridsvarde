CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_user_id` integer,
	`action` text NOT NULL,
	`detail` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `audit_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `check_ins` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`service_date` text NOT NULL,
	`fysisk` integer NOT NULL,
	`psykisk` integer NOT NULL,
	`social` integer NOT NULL,
	`somn` integer NOT NULL,
	`kost` integer NOT NULL,
	`energi` integer NOT NULL,
	`advice` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `check_ins_user_date` ON `check_ins` (`user_id`,`service_date`);--> statement-breakpoint
CREATE INDEX `check_ins_date` ON `check_ins` (`service_date`);--> statement-breakpoint
CREATE TABLE `login_attempts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ip` text NOT NULL,
	`succeeded` integer NOT NULL,
	`attempted_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `login_attempts_ip_time` ON `login_attempts` (`ip`,`attempted_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_user_id` integer NOT NULL,
	`subject_unit_id` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`service_date` text NOT NULL,
	`read_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notifications_recipient` ON `notifications` (`recipient_user_id`,`read_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_unique_per_day` ON `notifications` (`recipient_user_id`,`subject_unit_id`,`kind`,`service_date`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`parent_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `units_parent` ON `units` (`parent_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `units_parent_name` ON `units` (`parent_id`,`name`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code_hash` text NOT NULL,
	`label` text NOT NULL,
	`role` text NOT NULL,
	`unit_id` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`last_login_at` text,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_code_hash_unique` ON `users` (`code_hash`);--> statement-breakpoint
CREATE INDEX `users_unit` ON `users` (`unit_id`);--> statement-breakpoint
CREATE INDEX `users_role` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_unit_role_active` ON `users` (`unit_id`,`role`,`active`);