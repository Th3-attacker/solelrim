-- A till left open is closed by the system after 24 hours; this tells those
-- closures apart from ones made by a person.
ALTER TABLE "CashSession" ADD COLUMN "autoClosed" BOOLEAN NOT NULL DEFAULT false;
