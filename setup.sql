-- SCRIPT DE SETUP PARA HOSPEDAGEM COMPARTILHADA (VERSÃO LIMPA)
-- Importe este arquivo no seu phpMyAdmin para evitar erros de chaves duplicadas

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `Message`;
DROP TABLE IF EXISTS `Chat`;
DROP TABLE IF EXISTS `Contact`;
DROP TABLE IF EXISTS `User`;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `User` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL DEFAULT 'user',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Contact` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `phoneNumber` VARCHAR(191) NULL,
    `lastInteraction` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `source` VARCHAR(191) NOT NULL DEFAULT 'automatic',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Chat` (
    `id` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `jid` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `unreadCount` INTEGER NOT NULL DEFAULT 0,
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `assignedTo` VARCHAR(191) NULL,
    `assignedToName` VARCHAR(191) NULL,
    UNIQUE INDEX `Chat_sessionId_jid_key`(`sessionId`, `jid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `Message` (
    `id` VARCHAR(191) NOT NULL,
    `chatId` VARCHAR(191) NOT NULL,
    `jid` VARCHAR(191) NOT NULL,
    `fromMe` BOOLEAN NOT NULL,
    `text` TEXT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'text',
    `timestamp` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `messageTimestamp` INTEGER NOT NULL,
    `status` INTEGER NOT NULL DEFAULT 0,
    `mediaUrl` VARCHAR(191) NULL,
    `mediaType` VARCHAR(191) NULL,
    `fileName` VARCHAR(191) NULL,
    `quotedMessageId` VARCHAR(191) NULL,
    `quotedMessageText` TEXT NULL,
    INDEX `Message_jid_idx`(`jid`),
    INDEX `Message_chatId_idx`(`chatId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Chat` ADD CONSTRAINT `Chat_jid_fkey` FOREIGN KEY (`jid`) REFERENCES `Contact`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Message` ADD CONSTRAINT `Message_chatId_fkey` FOREIGN KEY (`chatId`) REFERENCES `Chat`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Message` ADD CONSTRAINT `Message_jid_fkey` FOREIGN KEY (`jid`) REFERENCES `Contact`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Inserir Admin Padrão (Senha: admin123)
INSERT IGNORE INTO `User` (`id`, `email`, `password`, `name`, `role`, `createdAt`, `updatedAt`) 
VALUES ('admin-user-01', 'uillian.bedinoto@gmail.com', '$2a$10$8K1p/a0WlBG9Z2UvM5v6O.v5v5v5v5v5v5v5v5v5v5v5v5v5v5v5', 'Administrador', 'admin', NOW(), NOW());
