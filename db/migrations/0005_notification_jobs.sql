CREATE TABLE IF NOT EXISTS `notification_jobs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tenantId` bigint unsigned NOT NULL,
  `kind` enum('confirmation','correction','reminder') NOT NULL,
  `idempotencyKey` varchar(255) NOT NULL,
  `payload` json NOT NULL,
  `status` enum('queued','processing','sent','failed') NOT NULL DEFAULT 'queued',
  `attempts` int NOT NULL DEFAULT 0,
  `nextAttemptAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `lastError` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `notification_jobs_idempotency` (`idempotencyKey`),
  KEY `notification_jobs_status_next_attempt` (`status`, `nextAttemptAt`),
  KEY `notification_jobs_tenant_created` (`tenantId`, `createdAt`)
);
