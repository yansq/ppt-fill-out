-- Developer-only schema. The platform system database remains report_platform.
CREATE TABLE IF NOT EXISTS `metric_record` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `data_source_code` VARCHAR(64) NOT NULL,
  `metric_code` VARCHAR(191) NOT NULL,
  `metric_name` VARCHAR(191) NOT NULL,
  `value_text` TEXT NOT NULL,
  `value_type` ENUM('NUMBER', 'STRING') NOT NULL,
  `unit` VARCHAR(64) NULL,
  `period` CHAR(7) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_by` VARCHAR(191) NOT NULL,
  `version` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `metric_record_source_code_period_key` (`data_source_code`, `metric_code`, `period`),
  KEY `metric_record_period_idx` (`period`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `metric_record_change` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `record_id` BIGINT UNSIGNED NOT NULL,
  `old_value_text` TEXT NOT NULL,
  `new_value_text` TEXT NOT NULL,
  `old_version` INT UNSIGNED NOT NULL,
  `new_version` INT UNSIGNED NOT NULL,
  `reason` TEXT NOT NULL,
  `updated_by` VARCHAR(191) NOT NULL,
  `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `metric_record_change_record_time_idx` (`record_id`, `updated_at`),
  CONSTRAINT `metric_record_change_record_fk` FOREIGN KEY (`record_id`) REFERENCES `metric_record` (`id`) ON DELETE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
