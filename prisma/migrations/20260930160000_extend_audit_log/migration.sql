-- Role, affected record, before/after values and reason on each audit
-- entry. All nullable: existing entries stay valid as they are.
ALTER TABLE "AdminAuditLog" ADD COLUMN "adminRole" "AdminRole",
ADD COLUMN "targetId" TEXT,
ADD COLUMN "oldValue" JSONB,
ADD COLUMN "newValue" JSONB,
ADD COLUMN "reason" TEXT;

CREATE INDEX "AdminAuditLog_productType_adminUserId_createdAt_idx" ON "AdminAuditLog"("productType", "adminUserId", "createdAt");

CREATE INDEX "AdminAuditLog_targetId_idx" ON "AdminAuditLog"("targetId");
