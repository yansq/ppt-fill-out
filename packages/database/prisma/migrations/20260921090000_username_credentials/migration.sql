-- Preserve existing users by assigning their unique email as their initial username.
ALTER TABLE `User` ADD COLUMN `username` VARCHAR(191) NULL;
UPDATE `User` SET `username` = `email`;
ALTER TABLE `User` MODIFY `username` VARCHAR(191) NOT NULL;
ALTER TABLE `User` MODIFY `email` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
