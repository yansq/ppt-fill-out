-- Add a unique six-digit employee number and preserve existing users with deterministic values.
ALTER TABLE `User` ADD COLUMN `employeeNumber` CHAR(6) NULL COMMENT '6位工号，用于登录';

UPDATE `User` AS `target`
JOIN (
    SELECT `id`, LPAD(ROW_NUMBER() OVER (ORDER BY `createdAt`, `id`), 6, '0') AS `employeeNumber`
    FROM `User`
) AS `numbered` ON `numbered`.`id` = `target`.`id`
SET `target`.`employeeNumber` = `numbered`.`employeeNumber`;

ALTER TABLE `User` MODIFY COLUMN `employeeNumber` CHAR(6) NOT NULL COMMENT '6位工号，用于登录';
CREATE UNIQUE INDEX `User_employeeNumber_key` ON `User`(`employeeNumber`);
