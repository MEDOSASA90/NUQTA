ALTER TABLE `nuqtat`
  ADD COLUMN IF NOT EXISTS `activeDuplicateKey` varchar(100);

UPDATE `nuqtat`
SET `activeDuplicateKey` = CONCAT(`tenantId`, ':', `eventId`, ':', `payerPersonId`)
WHERE `voidedAt` IS NULL AND `activeDuplicateKey` IS NULL;

ALTER TABLE `nuqtat`
  ADD UNIQUE KEY `nuqtat_active_duplicate` (`activeDuplicateKey`);
