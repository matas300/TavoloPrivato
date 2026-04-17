-- AlterTable
ALTER TABLE "RestaurantProfile" ADD COLUMN "stripeCustomerId" TEXT;

-- AlterTable
ALTER TABLE "WorkerProfile" ADD COLUMN "stripeAccountId" TEXT;

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerType" TEXT NOT NULL,
    "workerProfileId" INTEGER,
    "restaurantProfileId" INTEGER,
    "iban" TEXT NOT NULL,
    "bic" TEXT,
    "holderName" TEXT NOT NULL,
    "holderFiscalCode" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "verifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BankAccount_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BankAccount_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StripeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT
);

-- CreateIndex
CREATE INDEX "BankAccount_isPrimary_workerProfileId_idx" ON "BankAccount"("isPrimary", "workerProfileId");

-- CreateIndex
CREATE INDEX "BankAccount_isPrimary_restaurantProfileId_idx" ON "BankAccount"("isPrimary", "restaurantProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_workerProfileId_iban_key" ON "BankAccount"("workerProfileId", "iban");

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_restaurantProfileId_iban_key" ON "BankAccount"("restaurantProfileId", "iban");

-- CreateIndex
CREATE UNIQUE INDEX "StripeEvent_providerEventId_key" ON "StripeEvent"("providerEventId");

-- CreateIndex
CREATE INDEX "StripeEvent_status_receivedAt_idx" ON "StripeEvent"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantProfile_stripeCustomerId_key" ON "RestaurantProfile"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_stripeAccountId_key" ON "WorkerProfile"("stripeAccountId");

