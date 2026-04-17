-- CreateTable
CREATE TABLE "AgentDecision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agentJobId" INTEGER,
    "complianceAlertId" INTEGER,
    "complianceSnapshotId" INTEGER,
    "decisionKey" TEXT NOT NULL,
    "rationale" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("complianceSnapshotId") REFERENCES "ComplianceSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("complianceAlertId") REFERENCES "ComplianceAlert" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("agentJobId") REFERENCES "AgentJob" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "agentKey" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "actorUserId" INTEGER,
    "actorEmail" TEXT,
    "actionKey" TEXT NOT NULL,
    "targetTable" TEXT,
    "targetId" TEXT,
    "contextPayload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("actorUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChatThread" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER,
    "workerProfileId" INTEGER NOT NULL,
    "restaurantProfileId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceAlert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER,
    "restaurantProfileId" INTEGER,
    "snapshotId" INTEGER,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "alertMessage" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("snapshotId") REFERENCES "ComplianceSnapshot" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ComplianceSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pairMetricId" INTEGER,
    "serviceRequestId" INTEGER,
    "policyRuleId" INTEGER,
    "policyVersion" TEXT NOT NULL,
    "decisionState" TEXT NOT NULL,
    "snapshotPayload" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("policyRuleId") REFERENCES "PolicyRule" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("pairMetricId") REFERENCES "PairMetric" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "consentKey" TEXT NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractMilestone" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceContractId" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL,
    "milestoneLabel" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "invoiceDate" DATETIME NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "grossAmountEur" REAL NOT NULL,
    "platformFeeEur" REAL NOT NULL,
    "workerNetEur" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "providerInvoiceId" TEXT,
    "scheduledJobKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceContractId" INTEGER NOT NULL,
    "signerUserId" INTEGER NOT NULL,
    "signedAt" DATETIME NOT NULL,
    "signatureProvider" TEXT,
    "ipAddress" TEXT,
    FOREIGN KEY ("signerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateKey" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMd" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "CounterpartyGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "groupKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "EarningsScenario" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "visitorKey" TEXT,
    "audience" TEXT NOT NULL,
    "roleKey" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL,
    "currentNetMonthly" REAL NOT NULL,
    "forfettarioRate" REAL NOT NULL,
    "profitabilityCoefficient" REAL NOT NULL,
    "employeeNetAnnual" REAL NOT NULL,
    "companyCostAnnual" REAL NOT NULL,
    "freelanceNetAnnual" REAL NOT NULL,
    "annualGain" REAL NOT NULL,
    "monthlyGain" REAL NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EscrowLedger" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paymentOrderId" INTEGER NOT NULL,
    "entryType" TEXT NOT NULL,
    "amountEur" REAL NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormerEmployer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER NOT NULL,
    "employerName" TEXT NOT NULL,
    "employerVatNumber" TEXT,
    "endedOn" DATETIME NOT NULL,
    "relatedGroupKey" TEXT,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "restaurantId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledAt" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("restaurantId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
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
    FOREIGN KEY ("contractMilestoneId") REFERENCES "ContractMilestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManualReview" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "complianceAlertId" INTEGER NOT NULL,
    "reviewerUserId" INTEGER NOT NULL,
    "finalDecision" TEXT NOT NULL,
    "reviewerNotes" TEXT,
    "reviewedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("reviewerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("complianceAlertId") REFERENCES "ComplianceAlert" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "rankingScore" REAL NOT NULL,
    "complianceState" TEXT NOT NULL,
    "matchStatus" TEXT NOT NULL DEFAULT 'proposed',
    "proposedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchRanking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "rationale" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chatThreadId" INTEGER NOT NULL,
    "senderUserId" INTEGER NOT NULL,
    "messageBody" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL,
    "readAt" DATETIME,
    FOREIGN KEY ("senderUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("chatThreadId") REFERENCES "ChatThread" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NonRenewal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantProfileId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "effectiveDate" DATETIME NOT NULL,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "legalName" TEXT NOT NULL,
    "vatNumber" TEXT NOT NULL,
    "fiscalCode" TEXT,
    "legalForm" TEXT,
    "city" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counterpartyGroupId" INTEGER,
    FOREIGN KEY ("counterpartyGroupId") REFERENCES "CounterpartyGroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OutboxEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "eventKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PairMetric" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER NOT NULL,
    "restaurantProfileId" INTEGER NOT NULL,
    "days12m" INTEGER NOT NULL DEFAULT 0,
    "days24m" INTEGER NOT NULL DEFAULT 0,
    "gross12mEur" REAL NOT NULL DEFAULT 0,
    "gross24mEur" REAL NOT NULL DEFAULT 0,
    "workerRevenueShare12m" REAL NOT NULL DEFAULT 0,
    "workerRevenueShare24m" REAL NOT NULL DEFAULT 0,
    "controlScore" INTEGER NOT NULL DEFAULT 0,
    "lastRecomputedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceContractId" INTEGER NOT NULL,
    "contractMilestoneId" INTEGER,
    "provider" TEXT NOT NULL DEFAULT 'stripe_connect',
    "providerPaymentIntentId" TEXT,
    "providerInvoiceId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "amountTotalEur" REAL NOT NULL,
    "platformFeeEur" REAL NOT NULL,
    "payoutAmountEur" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "scheduledCaptureAt" DATETIME,
    "capturedAt" DATETIME,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("contractMilestoneId") REFERENCES "ContractMilestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paymentOrderId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "payoutAmountEur" REAL NOT NULL,
    "status" TEXT NOT NULL,
    "releasedAt" DATETIME,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "settingKey" TEXT NOT NULL PRIMARY KEY,
    "valueJson" JSONB NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PolicyRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "policyKey" TEXT NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "thresholdsJson" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "paymentOrderId" INTEGER NOT NULL,
    "amountEur" REAL NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RestaurantProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" INTEGER NOT NULL,
    "ownerUserId" INTEGER NOT NULL,
    "brandName" TEXT NOT NULL,
    "cuisineType" TEXT,
    "vibeTags" JSONB NOT NULL,
    "averageTicketEur" REAL,
    "description" TEXT,
    "ratingAvg" REAL,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("ownerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceContractId" INTEGER NOT NULL,
    "reviewerUserId" INTEGER NOT NULL,
    "revieweeUserId" INTEGER NOT NULL,
    "reliability" INTEGER NOT NULL,
    "punctuality" INTEGER NOT NULL,
    "professionalism" INTEGER NOT NULL,
    "commentText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("revieweeUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("reviewerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewAggregate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "reliabilityAvg" REAL NOT NULL DEFAULT 0,
    "punctualityAvg" REAL NOT NULL DEFAULT 0,
    "professionalismAvg" REAL NOT NULL DEFAULT 0,
    "overallAvg" REAL NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceContractId" INTEGER NOT NULL,
    "triggeredByUserId" INTEGER NOT NULL,
    "revieweeUserId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("revieweeUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("triggeredByUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceContractId") REFERENCES "ServiceContract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceContract" (
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
    "grossAmountEur" REAL NOT NULL,
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
    FOREIGN KEY ("templateId") REFERENCES "ContractTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantProfileId" INTEGER NOT NULL,
    "venueId" INTEGER,
    "packageName" TEXT NOT NULL,
    "serviceResultLabel" TEXT NOT NULL,
    "roleNeeded" TEXT NOT NULL,
    "flatFeeEur" REAL NOT NULL,
    "serviceDurationLabel" TEXT,
    "serviceType" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServiceRequest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "restaurantProfileId" INTEGER NOT NULL,
    "venueId" INTEGER,
    "servicePackageId" INTEGER,
    "engagementType" TEXT NOT NULL DEFAULT 'one_off',
    "requestedDate" DATETIME NOT NULL,
    "requestedEndDate" DATETIME,
    "estimatedServiceDays" INTEGER,
    "objectiveSummary" TEXT,
    "paymentTermsDays" TEXT NOT NULL DEFAULT 'd0',
    "paymentTermsBase" TEXT NOT NULL DEFAULT 'invoice_date',
    "requestedSkills" JSONB NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("servicePackageId") REFERENCES "ServicePackage" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("venueId") REFERENCES "Venue" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("restaurantProfileId") REFERENCES "RestaurantProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" INTEGER NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SplitRule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "servicePackageId" INTEGER,
    "workerSharePct" REAL NOT NULL,
    "platformSharePct" REAL NOT NULL,
    "notes" TEXT,
    FOREIGN KEY ("servicePackageId") REFERENCES "ServicePackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaxProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER NOT NULL,
    "annualGrossYtdEur" REAL NOT NULL DEFAULT 0,
    "platformGrossYtdEur" REAL NOT NULL DEFAULT 0,
    "largestCounterpartyShare" REAL NOT NULL DEFAULT 0,
    "riskBand" TEXT,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TrialService" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceRequestId" INTEGER NOT NULL,
    "workerProfileId" INTEGER NOT NULL,
    "outcome" TEXT,
    "scheduledAt" DATETIME,
    "completedAt" DATETIME,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    FOREIGN KEY ("serviceRequestId") REFERENCES "ServiceRequest" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "displayName" TEXT NOT NULL,
    "initials" TEXT,
    "avatarUrl" TEXT,
    "phoneE164" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Venue" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "organizationId" INTEGER NOT NULL,
    "restaurantId" INTEGER,
    "venueName" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "indoorCapacity" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("restaurantId") REFERENCES "RestaurantProfile" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerCertification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER NOT NULL,
    "certificationName" TEXT NOT NULL,
    "issuer" TEXT,
    "issuedOn" DATETIME,
    "expiresOn" DATETIME,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER NOT NULL,
    "documentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerPreference" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER NOT NULL,
    "preferredZones" JSONB NOT NULL,
    "preferredServiceTypes" JSONB NOT NULL,
    "maxTravelKm" INTEGER,
    "preferredShiftLabels" JSONB NOT NULL,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerProfile" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "taxMode" TEXT NOT NULL DEFAULT 'unknown',
    "vatNumber" TEXT,
    "headline" TEXT,
    "bio" TEXT,
    "homeCity" TEXT NOT NULL,
    "yearsExperience" INTEGER NOT NULL DEFAULT 0,
    "minimumFeeEur" REAL,
    "ratingAvg" REAL,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "availabilityJson" JSONB NOT NULL,
    "profileCompleteness" INTEGER NOT NULL DEFAULT 0,
    "safeHarborCandidate" BOOLEAN NOT NULL DEFAULT false,
    "isSeniorExempt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkerSkill" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workerProfileId" INTEGER NOT NULL,
    "skillCode" TEXT NOT NULL,
    "skillLevel" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    FOREIGN KEY ("workerProfileId") REFERENCES "WorkerProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AgentJob_agentKey_status_createdAt_idx" ON "AgentJob"("agentKey" ASC, "status" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "ChatThread_workerProfileId_restaurantProfileId_idx" ON "ChatThread"("workerProfileId" ASC, "restaurantProfileId" ASC);

-- CreateIndex
CREATE INDEX "ComplianceAlert_status_severity_createdAt_idx" ON "ComplianceAlert"("status" ASC, "severity" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "ComplianceSnapshot_decisionState_createdAt_idx" ON "ComplianceSnapshot"("decisionState" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Consent_userId_consentKey_consentVersion_key" ON "Consent"("userId" ASC, "consentKey" ASC, "consentVersion" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ContractMilestone_serviceContractId_sequence_key" ON "ContractMilestone"("serviceContractId" ASC, "sequence" ASC);

-- CreateIndex
CREATE INDEX "ContractMilestone_status_invoiceDate_dueDate_idx" ON "ContractMilestone"("status" ASC, "invoiceDate" ASC, "dueDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ContractSignature_serviceContractId_signerUserId_key" ON "ContractSignature"("serviceContractId" ASC, "signerUserId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_templateKey_key" ON "ContractTemplate"("templateKey" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "CounterpartyGroup_groupKey_key" ON "CounterpartyGroup"("groupKey" ASC);

-- CreateIndex
CREATE INDEX "EarningsScenario_visitorKey_audience_createdAt_idx" ON "EarningsScenario"("visitorKey" ASC, "audience" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "EarningsScenario_userId_audience_createdAt_idx" ON "EarningsScenario"("userId" ASC, "audience" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "EscrowLedger_paymentOrderId_createdAt_idx" ON "EscrowLedger"("paymentOrderId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "FormerEmployer_workerProfileId_endedOn_idx" ON "FormerEmployer"("workerProfileId" ASC, "endedOn" ASC);

-- CreateIndex
CREATE INDEX "Invoice_invoiceStatus_dueDate_issuedAt_idx" ON "Invoice"("invoiceStatus" ASC, "dueDate" ASC, "issuedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Match_serviceRequestId_workerProfileId_key" ON "Match"("serviceRequestId" ASC, "workerProfileId" ASC);

-- CreateIndex
CREATE INDEX "Match_complianceState_rankingScore_idx" ON "Match"("complianceState" ASC, "rankingScore" ASC);

-- CreateIndex
CREATE INDEX "MatchRanking_serviceRequestId_score_idx" ON "MatchRanking"("serviceRequestId" ASC, "score" ASC);

-- CreateIndex
CREATE INDEX "Message_chatThreadId_sentAt_idx" ON "Message"("chatThreadId" ASC, "sentAt" ASC);

-- CreateIndex
CREATE INDEX "Organization_city_idx" ON "Organization"("city" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_vatNumber_key" ON "Organization"("vatNumber" ASC);

-- CreateIndex
CREATE INDEX "OutboxEvent_eventKey_sentAt_idx" ON "OutboxEvent"("eventKey" ASC, "sentAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PairMetric_workerProfileId_restaurantProfileId_key" ON "PairMetric"("workerProfileId" ASC, "restaurantProfileId" ASC);

-- CreateIndex
CREATE INDEX "PairMetric_restaurantProfileId_controlScore_idx" ON "PairMetric"("restaurantProfileId" ASC, "controlScore" ASC);

-- CreateIndex
CREATE INDEX "PaymentOrder_serviceContractId_status_dueDate_idx" ON "PaymentOrder"("serviceContractId" ASC, "status" ASC, "dueDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_contractMilestoneId_key" ON "PaymentOrder"("contractMilestoneId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Payout_paymentOrderId_key" ON "Payout"("paymentOrderId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PolicyRule_policyKey_key" ON "PolicyRule"("policyKey" ASC);

-- CreateIndex
CREATE INDEX "RestaurantProfile_brandName_idx" ON "RestaurantProfile"("brandName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantProfile_ownerUserId_key" ON "RestaurantProfile"("ownerUserId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantProfile_organizationId_key" ON "RestaurantProfile"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Review_serviceContractId_reviewerUserId_key" ON "Review"("serviceContractId" ASC, "reviewerUserId" ASC);

-- CreateIndex
CREATE INDEX "Review_revieweeUserId_createdAt_idx" ON "Review"("revieweeUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAggregate_userId_key" ON "ReviewAggregate"("userId" ASC);

-- CreateIndex
CREATE INDEX "ServiceContract_workerProfileId_restaurantProfileId_serviceDate_idx" ON "ServiceContract"("workerProfileId" ASC, "restaurantProfileId" ASC, "serviceDate" ASC);

-- CreateIndex
CREATE INDEX "ServicePackage_restaurantProfileId_active_idx" ON "ServicePackage"("restaurantProfileId" ASC, "active" ASC);

-- CreateIndex
CREATE INDEX "ServiceRequest_restaurantProfileId_status_requestedDate_idx" ON "ServiceRequest"("restaurantProfileId" ASC, "status" ASC, "requestedDate" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_expiresAt_idx" ON "Session"("userId" ASC, "expiresAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SplitRule_servicePackageId_key" ON "SplitRule"("servicePackageId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TaxProfile_workerProfileId_key" ON "TaxProfile"("workerProfileId" ASC);

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role" ASC, "status" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "UserIdentity_provider_providerSubject_key" ON "UserIdentity"("provider" ASC, "providerSubject" ASC);

-- CreateIndex
CREATE INDEX "UserIdentity_userId_idx" ON "UserIdentity"("userId" ASC);

-- CreateIndex
CREATE INDEX "Venue_city_idx" ON "Venue"("city" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerPreference_workerProfileId_key" ON "WorkerPreference"("workerProfileId" ASC);

-- CreateIndex
CREATE INDEX "WorkerProfile_taxMode_homeCity_idx" ON "WorkerProfile"("taxMode" ASC, "homeCity" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerProfile_userId_key" ON "WorkerProfile"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "WorkerSkill_workerProfileId_skillCode_key" ON "WorkerSkill"("workerProfileId" ASC, "skillCode" ASC);

-- CreateIndex
CREATE INDEX "WorkerSkill_skillCode_verified_idx" ON "WorkerSkill"("skillCode" ASC, "verified" ASC);

