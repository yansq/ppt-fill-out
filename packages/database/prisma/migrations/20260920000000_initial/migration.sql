-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `emailVerified` DATETIME(3) NULL,
    `image` TEXT NULL,
    `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Role` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Role_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserRole` (
    `userId` VARCHAR(191) NOT NULL,
    `roleId` VARCHAR(191) NOT NULL,
    `assignedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`userId`, `roleId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(64) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerAccountId` VARCHAR(191) NOT NULL,
    `refresh_token` TEXT NULL,
    `access_token` TEXT NULL,
    `expires_at` INTEGER NULL,
    `token_type` VARCHAR(64) NULL,
    `scope` TEXT NULL,
    `id_token` TEXT NULL,
    `session_state` VARCHAR(191) NULL,

    INDEX `Account_userId_idx`(`userId`),
    UNIQUE INDEX `Account_provider_providerAccountId_key`(`provider`, `providerAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `sessionToken` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Session_sessionToken_key`(`sessionToken`),
    INDEX `Session_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `VerificationToken` (
    `identifier` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `expires` DATETIME(3) NOT NULL,

    UNIQUE INDEX `VerificationToken_token_key`(`token`),
    UNIQUE INDEX `VerificationToken_identifier_token_key`(`identifier`, `token`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportTemplate` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `status` ENUM('UPLOADING', 'PARSING', 'READY', 'PARSE_FAILED', 'ARCHIVED') NOT NULL DEFAULT 'UPLOADING',
    `sourceFileId` VARCHAR(191) NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `parserVersion` VARCHAR(64) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ReportTemplate_sourceFileId_key`(`sourceFileId`),
    INDEX `ReportTemplate_createdById_status_idx`(`createdById`, `status`),
    INDEX `ReportTemplate_sha256_idx`(`sha256`),
    UNIQUE INDEX `ReportTemplate_name_version_key`(`name`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TemplateSlide` (
    `id` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `slideIndex` INTEGER NOT NULL,
    `widthEmu` BIGINT NOT NULL,
    `heightEmu` BIGINT NOT NULL,
    `previewFileId` VARCHAR(191) NULL,
    `metadataJson` JSON NULL,

    UNIQUE INDEX `TemplateSlide_previewFileId_key`(`previewFileId`),
    UNIQUE INDEX `TemplateSlide_templateId_slideIndex_key`(`templateId`, `slideIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TemplatePlaceholder` (
    `id` VARCHAR(191) NOT NULL,
    `slideId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `occurrenceIndex` INTEGER NOT NULL,
    `shapeId` INTEGER NOT NULL,
    `shapeName` VARCHAR(191) NULL,
    `shapeType` VARCHAR(64) NOT NULL,
    `containerType` VARCHAR(64) NOT NULL,
    `paragraphIndex` INTEGER NULL,
    `startRunIndex` INTEGER NULL,
    `startOffset` INTEGER NULL,
    `endRunIndex` INTEGER NULL,
    `endOffset` INTEGER NULL,
    `tableRow` INTEGER NULL,
    `tableColumn` INTEGER NULL,
    `xEmu` BIGINT NOT NULL,
    `yEmu` BIGINT NOT NULL,
    `widthEmu` BIGINT NOT NULL,
    `heightEmu` BIGINT NOT NULL,
    `originalText` TEXT NOT NULL,
    `styleJson` JSON NULL,

    INDEX `TemplatePlaceholder_slideId_shapeId_idx`(`slideId`, `shapeId`),
    INDEX `TemplatePlaceholder_key_idx`(`key`),
    UNIQUE INDEX `TemplatePlaceholder_slideId_key_occurrenceIndex_key`(`slideId`, `key`, `occurrenceIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ReportTask` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `templateId` VARCHAR(191) NOT NULL,
    `reportPeriod` CHAR(7) NOT NULL,
    `status` ENUM('DRAFT', 'FILLING', 'REVIEWING', 'COMPLETED', 'EXPORTED') NOT NULL DEFAULT 'DRAFT',
    `collectorId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ReportTask_collectorId_status_idx`(`collectorId`, `status`),
    INDEX `ReportTask_reportPeriod_idx`(`reportPeriod`),
    INDEX `ReportTask_templateId_idx`(`templateId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SlideAssignment` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `templateSlideId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `SlideAssignment_assigneeId_idx`(`assigneeId`),
    UNIQUE INDEX `SlideAssignment_taskId_templateSlideId_assigneeId_key`(`taskId`, `templateSlideId`, `assigneeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FillInstance` (
    `id` VARCHAR(191) NOT NULL,
    `assignmentId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `templateSlideId` VARCHAR(191) NOT NULL,
    `assigneeId` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'REVIEWED') NOT NULL DEFAULT 'NOT_STARTED',
    `version` INTEGER NOT NULL DEFAULT 0,
    `submittedAt` DATETIME(3) NULL,
    `reviewedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `FillInstance_assignmentId_key`(`assignmentId`),
    INDEX `FillInstance_assigneeId_status_idx`(`assigneeId`, `status`),
    INDEX `FillInstance_taskId_status_idx`(`taskId`, `status`),
    INDEX `FillInstance_templateSlideId_idx`(`templateSlideId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlaceholderBinding` (
    `id` VARCHAR(191) NOT NULL,
    `fillInstanceId` VARCHAR(191) NOT NULL,
    `placeholderId` VARCHAR(191) NOT NULL,
    `sourceType` ENUM('DATABASE_METRIC', 'MANUAL_TEXT', 'AI_GENERATED', 'EXPRESSION', 'API') NOT NULL,
    `metricDefinitionId` VARCHAR(191) NULL,
    `metricPeriod` CHAR(7) NULL,
    `manualValue` TEXT NULL,
    `aiGenerationId` VARCHAR(191) NULL,
    `formatOptionsJson` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `updatedById` VARCHAR(191) NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `PlaceholderBinding_metricDefinitionId_idx`(`metricDefinitionId`),
    UNIQUE INDEX `PlaceholderBinding_fillInstanceId_placeholderId_key`(`fillInstanceId`, `placeholderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubmittedValue` (
    `id` VARCHAR(191) NOT NULL,
    `fillInstanceId` VARCHAR(191) NOT NULL,
    `placeholderId` VARCHAR(191) NOT NULL,
    `valueText` LONGTEXT NOT NULL,
    `sourceType` ENUM('DATABASE_METRIC', 'MANUAL_TEXT', 'AI_GENERATED', 'EXPRESSION', 'API') NOT NULL,
    `sourceSnapshotJson` JSON NULL,
    `bindingSnapshotJson` JSON NOT NULL,
    `submittedById` VARCHAR(191) NOT NULL,
    `submittedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `submissionRevision` INTEGER NOT NULL,

    INDEX `SubmittedValue_placeholderId_submittedAt_idx`(`placeholderId`, `submittedAt`),
    UNIQUE INDEX `SubmittedValue_fillInstanceId_placeholderId_submissionRevisi_key`(`fillInstanceId`, `placeholderId`, `submissionRevision`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FinalValue` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `placeholderId` VARCHAR(191) NOT NULL,
    `valueText` LONGTEXT NOT NULL,
    `resolutionType` ENUM('SELECTED_SUBMISSION', 'MANUAL') NOT NULL,
    `selectedSubmittedValueId` VARCHAR(191) NULL,
    `sourceSnapshotJson` JSON NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `decidedById` VARCHAR(191) NOT NULL,
    `decidedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `FinalValue_selectedSubmittedValueId_idx`(`selectedSubmittedValueId`),
    UNIQUE INDEX `FinalValue_taskId_placeholderId_key`(`taskId`, `placeholderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DataSource` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('MYSQL', 'OCEANBASE', 'ORACLE', 'SQL_SERVER', 'REST_API') NOT NULL,
    `status` ENUM('ACTIVE', 'DISABLED', 'ERROR') NOT NULL DEFAULT 'ACTIVE',
    `host` VARCHAR(255) NULL,
    `port` INTEGER NULL,
    `databaseName` VARCHAR(191) NULL,
    `username` VARCHAR(191) NULL,
    `encryptedPassword` TEXT NULL,
    `encryptionKeyVersion` VARCHAR(64) NULL,
    `optionsJson` JSON NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `DataSource_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetricDefinition` (
    `id` VARCHAR(191) NOT NULL,
    `dataSourceId` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `valueType` ENUM('STRING', 'NUMBER', 'BOOLEAN', 'DATE', 'JSON') NOT NULL,
    `unit` VARCHAR(64) NULL,
    `writable` BOOLEAN NOT NULL DEFAULT false,
    `queryConfigJson` JSON NOT NULL,
    `updateConfigJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MetricDefinition_name_idx`(`name`),
    UNIQUE INDEX `MetricDefinition_dataSourceId_code_key`(`dataSourceId`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetricValue` (
    `id` VARCHAR(191) NOT NULL,
    `metricDefinitionId` VARCHAR(191) NOT NULL,
    `period` CHAR(7) NOT NULL,
    `dimensionsHash` CHAR(64) NOT NULL,
    `dimensionsJson` JSON NULL,
    `valueText` LONGTEXT NOT NULL,
    `valueNumber` DECIMAL(65, 18) NULL,
    `sourceVersion` VARCHAR(191) NULL,
    `sourceUpdatedAt` DATETIME(3) NULL,
    `version` INTEGER NOT NULL DEFAULT 0,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MetricValue_period_idx`(`period`),
    UNIQUE INDEX `MetricValue_metricDefinitionId_period_dimensionsHash_key`(`metricDefinitionId`, `period`, `dimensionsHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MetricValueHistory` (
    `id` VARCHAR(191) NOT NULL,
    `metricValueId` VARCHAR(191) NOT NULL,
    `oldValueJson` JSON NOT NULL,
    `newValueJson` JSON NOT NULL,
    `reason` TEXT NOT NULL,
    `operatorId` VARCHAR(191) NOT NULL,
    `expectedVersion` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MetricValueHistory_metricValueId_createdAt_idx`(`metricValueId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoredFile` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('TEMPLATE', 'PREVIEW', 'GENERATED', 'TEMP') NOT NULL,
    `storagePath` VARCHAR(768) NOT NULL,
    `originalFilename` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL,
    `sha256` CHAR(64) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `StoredFile_storagePath_key`(`storagePath`),
    INDEX `StoredFile_sha256_category_idx`(`sha256`, `category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `GeneratedFile` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `type` ENUM('PPTX', 'PDF', 'PNG') NOT NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `storedFileId` VARCHAR(191) NULL,
    `valuesSnapshotJson` JSON NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `errorCode` VARCHAR(64) NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    UNIQUE INDEX `GeneratedFile_storedFileId_key`(`storedFileId`),
    UNIQUE INDEX `GeneratedFile_idempotencyKey_key`(`idempotencyKey`),
    INDEX `GeneratedFile_taskId_status_idx`(`taskId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiGeneration` (
    `id` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NOT NULL,
    `placeholderId` VARCHAR(191) NULL,
    `promptTemplateKey` VARCHAR(191) NOT NULL,
    `inputSnapshotJson` JSON NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `model` VARCHAR(191) NOT NULL,
    `outputText` LONGTEXT NOT NULL,
    `acceptedText` LONGTEXT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AiGeneration_taskId_createdAt_idx`(`taskId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OperationLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `resourceType` VARCHAR(64) NOT NULL,
    `resourceId` VARCHAR(191) NOT NULL,
    `taskId` VARCHAR(191) NULL,
    `beforeJson` JSON NULL,
    `afterJson` JSON NULL,
    `metadataJson` JSON NULL,
    `correlationId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OperationLog_resourceType_resourceId_createdAt_idx`(`resourceType`, `resourceId`, `createdAt`),
    INDEX `OperationLog_taskId_createdAt_idx`(`taskId`, `createdAt`),
    INDEX `OperationLog_correlationId_idx`(`correlationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRole` ADD CONSTRAINT `UserRole_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `Role`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportTemplate` ADD CONSTRAINT `ReportTemplate_sourceFileId_fkey` FOREIGN KEY (`sourceFileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportTemplate` ADD CONSTRAINT `ReportTemplate_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TemplateSlide` ADD CONSTRAINT `TemplateSlide_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ReportTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TemplateSlide` ADD CONSTRAINT `TemplateSlide_previewFileId_fkey` FOREIGN KEY (`previewFileId`) REFERENCES `StoredFile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TemplatePlaceholder` ADD CONSTRAINT `TemplatePlaceholder_slideId_fkey` FOREIGN KEY (`slideId`) REFERENCES `TemplateSlide`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportTask` ADD CONSTRAINT `ReportTask_templateId_fkey` FOREIGN KEY (`templateId`) REFERENCES `ReportTemplate`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ReportTask` ADD CONSTRAINT `ReportTask_collectorId_fkey` FOREIGN KEY (`collectorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlideAssignment` ADD CONSTRAINT `SlideAssignment_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ReportTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlideAssignment` ADD CONSTRAINT `SlideAssignment_templateSlideId_fkey` FOREIGN KEY (`templateSlideId`) REFERENCES `TemplateSlide`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlideAssignment` ADD CONSTRAINT `SlideAssignment_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SlideAssignment` ADD CONSTRAINT `SlideAssignment_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FillInstance` ADD CONSTRAINT `FillInstance_assignmentId_fkey` FOREIGN KEY (`assignmentId`) REFERENCES `SlideAssignment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FillInstance` ADD CONSTRAINT `FillInstance_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ReportTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FillInstance` ADD CONSTRAINT `FillInstance_templateSlideId_fkey` FOREIGN KEY (`templateSlideId`) REFERENCES `TemplateSlide`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FillInstance` ADD CONSTRAINT `FillInstance_assigneeId_fkey` FOREIGN KEY (`assigneeId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceholderBinding` ADD CONSTRAINT `PlaceholderBinding_fillInstanceId_fkey` FOREIGN KEY (`fillInstanceId`) REFERENCES `FillInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceholderBinding` ADD CONSTRAINT `PlaceholderBinding_placeholderId_fkey` FOREIGN KEY (`placeholderId`) REFERENCES `TemplatePlaceholder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceholderBinding` ADD CONSTRAINT `PlaceholderBinding_metricDefinitionId_fkey` FOREIGN KEY (`metricDefinitionId`) REFERENCES `MetricDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceholderBinding` ADD CONSTRAINT `PlaceholderBinding_aiGenerationId_fkey` FOREIGN KEY (`aiGenerationId`) REFERENCES `AiGeneration`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlaceholderBinding` ADD CONSTRAINT `PlaceholderBinding_updatedById_fkey` FOREIGN KEY (`updatedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmittedValue` ADD CONSTRAINT `SubmittedValue_fillInstanceId_fkey` FOREIGN KEY (`fillInstanceId`) REFERENCES `FillInstance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmittedValue` ADD CONSTRAINT `SubmittedValue_placeholderId_fkey` FOREIGN KEY (`placeholderId`) REFERENCES `TemplatePlaceholder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmittedValue` ADD CONSTRAINT `SubmittedValue_submittedById_fkey` FOREIGN KEY (`submittedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalValue` ADD CONSTRAINT `FinalValue_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ReportTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalValue` ADD CONSTRAINT `FinalValue_placeholderId_fkey` FOREIGN KEY (`placeholderId`) REFERENCES `TemplatePlaceholder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalValue` ADD CONSTRAINT `FinalValue_selectedSubmittedValueId_fkey` FOREIGN KEY (`selectedSubmittedValueId`) REFERENCES `SubmittedValue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FinalValue` ADD CONSTRAINT `FinalValue_decidedById_fkey` FOREIGN KEY (`decidedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DataSource` ADD CONSTRAINT `DataSource_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetricDefinition` ADD CONSTRAINT `MetricDefinition_dataSourceId_fkey` FOREIGN KEY (`dataSourceId`) REFERENCES `DataSource`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetricValue` ADD CONSTRAINT `MetricValue_metricDefinitionId_fkey` FOREIGN KEY (`metricDefinitionId`) REFERENCES `MetricDefinition`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetricValueHistory` ADD CONSTRAINT `MetricValueHistory_metricValueId_fkey` FOREIGN KEY (`metricValueId`) REFERENCES `MetricValue`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MetricValueHistory` ADD CONSTRAINT `MetricValueHistory_operatorId_fkey` FOREIGN KEY (`operatorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoredFile` ADD CONSTRAINT `StoredFile_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedFile` ADD CONSTRAINT `GeneratedFile_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ReportTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedFile` ADD CONSTRAINT `GeneratedFile_storedFileId_fkey` FOREIGN KEY (`storedFileId`) REFERENCES `StoredFile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `GeneratedFile` ADD CONSTRAINT `GeneratedFile_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiGeneration` ADD CONSTRAINT `AiGeneration_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ReportTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiGeneration` ADD CONSTRAINT `AiGeneration_placeholderId_fkey` FOREIGN KEY (`placeholderId`) REFERENCES `TemplatePlaceholder`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiGeneration` ADD CONSTRAINT `AiGeneration_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationLog` ADD CONSTRAINT `OperationLog_actorId_fkey` FOREIGN KEY (`actorId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OperationLog` ADD CONSTRAINT `OperationLog_taskId_fkey` FOREIGN KEY (`taskId`) REFERENCES `ReportTask`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
