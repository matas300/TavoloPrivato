-- Task 4 sub-2: rename grossAmountEur -> taxableAmountEur on ServiceContract e ContractMilestone,
-- aggiunta colonne fiscali (withholding, totalDue, netToWorker, taxRegimeSnapshot) su
-- Invoice / Payout / PaymentOrder. Zero perdita di dati: il rename avviene via table-rebuild
-- con INSERT ... SELECT che MAPPA esplicitamente la vecchia colonna grossAmountEur nella nuova
-- taxableAmountEur.
-- NOTE: SQL scritto a mano perché `prisma migrate diff` non riconosce il rename (Prisma non
-- supporta @map rename su SQLite senza annotazioni speciali) e genererebbe DROP+ADD con
-- INSERT SELECT incompleto (perdita dei valori monetari).

-- AlterTable additiva su PaymentOrder (non richiede rebuild)
ALTER TABLE "PaymentOrder" ADD COLUMN "totalDueEur" REAL;

-- RedefineTables con mapping esplicito grossAmountEur -> taxableAmountEur
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- ContractMilestone: rebuild + rename colonna con mapping esplicito
CREATE TABLE "new_ContractMilestone" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceContractId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "milestoneLabel" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "taxableAmountEur" REAL NOT NULL,
    "platformFeeEur" REAL NOT NULL,
    "workerNetEur" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "providerInvoiceId" TEXT,
    "scheduledJobKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractMilestone_serviceContractId_fkey" FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ContractMilestone" ("createdAt", "dueDate", "id", "invoiceDate", "milestoneLabel", "periodEnd", "periodStart", "platformFeeEur", "providerInvoiceId", "scheduledJobKey", "sequence", "serviceContractId", "status", "updatedAt", "workerNetEur", "taxableAmountEur")
SELECT "createdAt", "dueDate", "id", "invoiceDate", "milestoneLabel", "periodEnd", "periodStart", "platformFeeEur", "providerInvoiceId", "scheduledJobKey", "sequence", "serviceContractId", "status", "updatedAt", "workerNetEur", "grossAmountEur" FROM "ContractMilestone";
DROP TABLE "ContractMilestone";
ALTER TABLE "new_ContractMilestone" RENAME TO "ContractMilestone";
CREATE INDEX "ContractMilestone_status_invoiceDate_dueDate_idx" ON "ContractMilestone"("status", "invoiceDate", "dueDate");
CREATE UNIQUE INDEX "ContractMilestone_serviceContractId_sequence_key" ON "ContractMilestone"("serviceContractId", "sequence");

-- Invoice: rebuild additivo — aggiunge colonne fiscali (tutte nullable o con default 0)
CREATE TABLE "new_Invoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paymentOrderId" INTEGER NOT NULL,
    "serviceContractId" INTEGER,
    "contractMilestoneId" INTEGER,
    "invoiceType" TEXT NOT NULL,
    "externalNumber" TEXT,
    "providerInvoiceId" TEXT,
    "invoiceStatus" TEXT NOT NULL DEFAULT 'draft',
    "amountEur" REAL NOT NULL,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "pdfUrl" TEXT,
    "paymentTermsDays" TEXT,
    "paymentTermsBase" TEXT,
    "taxableAmountEur" REAL,
    "withholdingRate" REAL NOT NULL DEFAULT 0,
    "withholdingAmountEur" REAL NOT NULL DEFAULT 0,
    "totalDueEur" REAL,
    "netToWorkerEur" REAL,
    "taxRegimeSnapshot" TEXT,
    CONSTRAINT "Invoice_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_serviceContractId_fkey" FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Invoice_contractMilestoneId_fkey" FOREIGN KEY ("contractMilestoneId") REFERENCES "ContractMilestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Invoice" ("amountEur", "contractMilestoneId", "dueDate", "externalNumber", "id", "invoiceStatus", "invoiceType", "issuedAt", "paidAt", "paymentOrderId", "paymentTermsBase", "paymentTermsDays", "pdfUrl", "providerInvoiceId", "serviceContractId")
SELECT "amountEur", "contractMilestoneId", "dueDate", "externalNumber", "id", "invoiceStatus", "invoiceType", "issuedAt", "paidAt", "paymentOrderId", "paymentTermsBase", "paymentTermsDays", "pdfUrl", "providerInvoiceId", "serviceContractId" FROM "Invoice";
DROP TABLE "Invoice";
ALTER TABLE "new_Invoice" RENAME TO "Invoice";
CREATE INDEX "Invoice_invoiceStatus_dueDate_issuedAt_idx" ON "Invoice"("invoiceStatus", "dueDate", "issuedAt");

-- Payout: rebuild additivo per aggiungere withholdingAmountEur
CREATE TABLE "new_Payout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paymentOrderId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "payoutAmountEur" REAL NOT NULL,
    "withholdingAmountEur" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL,
    "releasedAt" DATETIME,
    CONSTRAINT "Payout_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payout_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Payout" ("id", "paymentOrderId", "payoutAmountEur", "releasedAt", "status", "workerProfileId")
SELECT "id", "paymentOrderId", "payoutAmountEur", "releasedAt", "status", "workerProfileId" FROM "Payout";
DROP TABLE "Payout";
ALTER TABLE "new_Payout" RENAME TO "Payout";
CREATE UNIQUE INDEX "Payout_paymentOrderId_key" ON "Payout"("paymentOrderId");

-- ServiceContract: rebuild + rename colonna con mapping esplicito
CREATE TABLE "new_ServiceContract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER,
    "workerProfileId" INTEGER NOT NULL,
    "restaurantProfileId" INTEGER NOT NULL,
    "contractMode" TEXT NOT NULL,
    "templateId" INTEGER,
    "contractTitle" TEXT NOT NULL DEFAULT 'Contratto di Prestazione d''Opera Autonoma ex art. 2222 C.c.',
    "engagementType" TEXT NOT NULL DEFAULT 'one_off',
    "objectiveSummary" TEXT,
    "scopeOfWorkJson" JSONB,
    "taxableAmountEur" REAL NOT NULL,
    "platformFeeEur" REAL NOT NULL,
    "workerNetEur" REAL NOT NULL,
    "serviceDate" DATETIME NOT NULL,
    "serviceStartDate" DATETIME,
    "serviceEndDate" DATETIME,
    "estimatedServiceDays" INTEGER,
    "monthlyGrossAmountEur" REAL,
    "paymentTermsDays" TEXT NOT NULL DEFAULT 'd0',
    "paymentTermsBase" TEXT NOT NULL DEFAULT 'invoice_date',
    "billingFrequency" TEXT,
    "pdfUrl" TEXT,
    "contractSnapshot" JSONB,
    "serviceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceContract_serviceRequestId_fkey" FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ServiceContract_workerProfileId_fkey" FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceContract_restaurantProfileId_fkey" FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServiceContract_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ServiceContract" ("billingFrequency", "contractMode", "contractSnapshot", "contractTitle", "createdAt", "engagementType", "estimatedServiceDays", "id", "monthlyGrossAmountEur", "objectiveSummary", "paymentTermsBase", "paymentTermsDays", "pdfUrl", "platformFeeEur", "restaurantProfileId", "scopeOfWorkJson", "serviceDate", "serviceEndDate", "serviceRequestId", "serviceStartDate", "serviceType", "status", "templateId", "workerNetEur", "workerProfileId", "taxableAmountEur")
SELECT "billingFrequency", "contractMode", "contractSnapshot", "contractTitle", "createdAt", "engagementType", "estimatedServiceDays", "id", "monthlyGrossAmountEur", "objectiveSummary", "paymentTermsBase", "paymentTermsDays", "pdfUrl", "platformFeeEur", "restaurantProfileId", "scopeOfWorkJson", "serviceDate", "serviceEndDate", "serviceRequestId", "serviceStartDate", "serviceType", "status", "templateId", "workerNetEur", "workerProfileId", "grossAmountEur" FROM "ServiceContract";
DROP TABLE "ServiceContract";
ALTER TABLE "new_ServiceContract" RENAME TO "ServiceContract";
CREATE INDEX "ServiceContract_workerProfileId_restaurantProfileId_serviceDate_idx" ON "ServiceContract"("workerProfileId", "restaurantProfileId", "serviceDate");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
