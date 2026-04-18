-- CreateTable
CREATE TABLE "WithholdingAccrual" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantProfileId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "periodYear" INTEGER NOT NULL,
    "periodMonth" INTEGER NOT NULL,
    "taxRegimeSnapshot" TEXT NOT NULL,
    "totalAmountEur" REAL NOT NULL DEFAULT 0,
    "invoiceCount" INTEGER NOT NULL DEFAULT 0,
    "firstInvoiceAt" DATETIME NOT NULL,
    "lastInvoiceAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WithholdingAccrual_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WithholdingAccrual_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_StripeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastRetryAt" DATETIME
);
INSERT INTO "new_StripeEvent" ("error", "eventType", "id", "payload", "processedAt", "providerEventId", "receivedAt", "status") SELECT "error", "eventType", "id", "payload", "processedAt", "providerEventId", "receivedAt", "status" FROM "StripeEvent";
DROP TABLE "StripeEvent";
ALTER TABLE "new_StripeEvent" RENAME TO "StripeEvent";
CREATE UNIQUE INDEX "StripeEvent_providerEventId_key" ON "StripeEvent"("providerEventId");
CREATE INDEX "StripeEvent_status_receivedAt_idx" ON "StripeEvent"("status", "receivedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "WithholdingAccrual_restaurantProfileId_periodYear_periodMonth_idx" ON "WithholdingAccrual"("restaurantProfileId", "periodYear", "periodMonth");

-- CreateIndex
CREATE UNIQUE INDEX "WithholdingAccrual_restaurantProfileId_workerProfileId_periodYear_periodMonth_taxRegimeSnapshot_key" ON "WithholdingAccrual"("restaurantProfileId", "workerProfileId", "periodYear", "periodMonth", "taxRegimeSnapshot");
