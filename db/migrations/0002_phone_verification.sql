ALTER TABLE `whatsapp_messages`
  MODIFY COLUMN `kind` enum('reminder','confirmation','phone_verification','correction','bot_reply','bot_query') NOT NULL;

CREATE TABLE IF NOT EXISTS `phone_verification_challenges` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` bigint unsigned NOT NULL,
  `personId` bigint unsigned NOT NULL,
  `phone` varchar(32) NOT NULL,
  `codeHash` varchar(128) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `attempts` int NOT NULL DEFAULT 0,
  `consumedAt` timestamp NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `phone_challenges_person` (`tenantId`,`personId`,`createdAt`)
);
