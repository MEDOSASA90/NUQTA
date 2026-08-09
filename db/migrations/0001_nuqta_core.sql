CREATE TABLE IF NOT EXISTS `regions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `normalizedName` varchar(255) NOT NULL,
  `createdByUserId` bigint unsigned NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `regions_normalized_name` (`normalizedName`)
);

ALTER TABLE `tenant_members`
  ADD COLUMN `permissions` json NOT NULL DEFAULT (JSON_ARRAY());

ALTER TABLE `persons`
  ADD COLUMN `nuqtaId` varchar(40) NULL,
  ADD COLUMN `regionId` bigint unsigned NULL,
  ADD KEY `persons_nuqta_id` (`nuqtaId`),
  ADD UNIQUE KEY `persons_tenant_nuqta` (`tenantId`, `nuqtaId`);

ALTER TABLE `events`
  ADD COLUMN `lifecycleStatus` enum('draft','scheduled','live','completed','archived') NOT NULL DEFAULT 'draft';

ALTER TABLE `nuqtat`
  ADD COLUMN `notificationSentAt` timestamp NULL,
  ADD COLUMN `voidedAt` timestamp NULL,
  ADD COLUMN `voidedByUserId` bigint unsigned NULL,
  ADD COLUMN `voidReason` text NULL;

UPDATE `events` SET `lifecycleStatus` = CASE `status`
  WHEN 'upcoming' THEN 'scheduled'
  WHEN 'open' THEN 'live'
  WHEN 'done' THEN 'completed'
  ELSE 'draft'
END;

UPDATE `persons`
SET `nuqtaId` = CONCAT('NQ-', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 16)))
WHERE `nuqtaId` IS NULL;

