-- The mobile money number a payment was actually sent from — collected at
-- checkout right before the proof screenshot, so the admin can match the
-- screenshot to a transaction even when it's not the customer's own number.
-- Nullable: existing orders predate this field and have no value for it.
ALTER TABLE "Order" ADD COLUMN "paymentSenderPhone" TEXT;
