-- Frozen totals of a closed session (see CashSession.closingSummary).
ALTER TABLE "CashSession" ADD COLUMN "closingSummary" JSONB;
