CREATE TABLE `audit_log` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`actorUserId` bigint unsigned,
	`entityType` varchar(64) NOT NULL,
	`entityId` bigint unsigned NOT NULL,
	`action` enum('create','update','delete') NOT NULL,
	`beforeJson` json,
	`afterJson` json,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_assignments` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`eventId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`assignedBy` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `event_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `event_assignments_event_user` UNIQUE(`eventId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`hostPersonId` bigint unsigned,
	`hostName` varchar(255) NOT NULL,
	`eventDate` date NOT NULL,
	`status` enum('upcoming','open','done') NOT NULL DEFAULT 'upcoming',
	`lifecycleStatus` enum('draft','scheduled','live','completed','archived') NOT NULL DEFAULT 'draft',
	`place` varchar(255) NOT NULL DEFAULT '',
	`shareToken` varchar(64) NOT NULL,
	`openedAt` timestamp,
	`closedAt` timestamp,
	`closedByUserId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `events_id` PRIMARY KEY(`id`),
	CONSTRAINT `events_share_token` UNIQUE(`shareToken`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`eventId` bigint unsigned NOT NULL,
	`receiverName` varchar(255) NOT NULL,
	`receiverPersonId` bigint unsigned,
	`amount` int NOT NULL,
	`handedByUserId` bigint unsigned,
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_jobs` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`kind` enum('confirmation','correction','reminder') NOT NULL,
	`idempotencyKey` varchar(255) NOT NULL,
	`payload` json NOT NULL,
	`status` enum('queued','processing','sent','failed') NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`nextAttemptAt` timestamp NOT NULL DEFAULT (now()),
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notification_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `notification_jobs_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `nuqtat` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`eventId` bigint unsigned NOT NULL,
	`payerPersonId` bigint unsigned NOT NULL,
	`amount` int NOT NULL,
	`invitedBy` varchar(255) NOT NULL DEFAULT '',
	`recordedByUserId` bigint unsigned,
	`whatsappNotified` boolean NOT NULL DEFAULT false,
	`notificationSentAt` timestamp,
	`voidedAt` timestamp,
	`voidedByUserId` bigint unsigned,
	`voidReason` text,
	`activeDuplicateKey` varchar(100),
	`editedAfterDone` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `nuqtat_id` PRIMARY KEY(`id`),
	CONSTRAINT `nuqtat_active_duplicate` UNIQUE(`activeDuplicateKey`)
);
--> statement-breakpoint
CREATE TABLE `persons` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`name` varchar(255) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`region` varchar(255) NOT NULL DEFAULT '',
	`nuqtaId` varchar(40),
	`regionId` bigint unsigned,
	`phoneVerified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `persons_id` PRIMARY KEY(`id`),
	CONSTRAINT `persons_tenant_phone` UNIQUE(`tenantId`,`phone`),
	CONSTRAINT `persons_tenant_nuqta` UNIQUE(`tenantId`,`nuqtaId`)
);
--> statement-breakpoint
CREATE TABLE `phone_verification_challenges` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`personId` bigint unsigned NOT NULL,
	`phone` varchar(32) NOT NULL,
	`codeHash` varchar(128) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`attempts` int NOT NULL DEFAULT 0,
	`consumedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `phone_verification_challenges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `regions` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`normalizedName` varchar(255) NOT NULL,
	`createdByUserId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `regions_id` PRIMARY KEY(`id`),
	CONSTRAINT `regions_normalized_name` UNIQUE(`normalizedName`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`eventId` bigint unsigned NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`fileUrl` varchar(512) NOT NULL DEFAULT '',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_members` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`userId` bigint unsigned NOT NULL,
	`role` enum('scribe','team') NOT NULL DEFAULT 'team',
	`permissions` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenant_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenant_members_tenant_user` UNIQUE(`tenantId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`ownerUserId` bigint unsigned NOT NULL,
	`settings` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`unionId` varchar(255) NOT NULL,
	`name` varchar(255),
	`email` varchar(320),
	`passwordHash` varchar(255),
	`avatar` text,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	`lastSignInAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_unionId_unique` UNIQUE(`unionId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`tenantId` bigint unsigned NOT NULL,
	`personId` bigint unsigned,
	`phone` varchar(32) NOT NULL,
	`direction` enum('out','in') NOT NULL,
	`kind` enum('reminder','confirmation','phone_verification','correction','bot_reply','bot_query') NOT NULL,
	`body` text NOT NULL,
	`status` enum('queued','sent','delivered','failed','simulated') NOT NULL DEFAULT 'queued',
	`eventId` bigint unsigned,
	`nuqtaId` bigint unsigned,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_tenant_entity` ON `audit_log` (`tenantId`,`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `audit_tenant_created` ON `audit_log` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `event_assignments_event` ON `event_assignments` (`eventId`);--> statement-breakpoint
CREATE INDEX `events_tenant_date` ON `events` (`tenantId`,`eventDate`);--> statement-breakpoint
CREATE INDEX `events_tenant_host` ON `events` (`tenantId`,`hostPersonId`);--> statement-breakpoint
CREATE INDEX `expenses_tenant_event` ON `expenses` (`tenantId`,`eventId`);--> statement-breakpoint
CREATE INDEX `notification_jobs_status_next_attempt` ON `notification_jobs` (`status`,`nextAttemptAt`);--> statement-breakpoint
CREATE INDEX `notification_jobs_tenant_created` ON `notification_jobs` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `nuqtat_tenant_event` ON `nuqtat` (`tenantId`,`eventId`);--> statement-breakpoint
CREATE INDEX `nuqtat_tenant_payer` ON `nuqtat` (`tenantId`,`payerPersonId`);--> statement-breakpoint
CREATE INDEX `persons_nuqta_id` ON `persons` (`nuqtaId`);--> statement-breakpoint
CREATE INDEX `persons_tenant_name` ON `persons` (`tenantId`,`name`);--> statement-breakpoint
CREATE INDEX `phone_challenges_person` ON `phone_verification_challenges` (`tenantId`,`personId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `reports_tenant_event` ON `reports` (`tenantId`,`eventId`);--> statement-breakpoint
CREATE INDEX `tenant_members_user` ON `tenant_members` (`userId`);--> statement-breakpoint
CREATE INDEX `wa_tenant_created` ON `whatsapp_messages` (`tenantId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `wa_tenant_person` ON `whatsapp_messages` (`tenantId`,`personId`);