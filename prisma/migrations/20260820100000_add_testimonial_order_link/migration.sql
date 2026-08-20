-- Optional link from a Testimonial to the real DELIVERED Order it came
-- from, so the storefront can show a genuine "verified purchase" badge on
-- the ones an admin chose to link, instead of every testimonial reading as
-- equally authenticated. Nullable and SetNull on delete — an unlinked
-- testimonial (or one whose order gets deleted later) is still valid
-- admin-entered copy, it just isn't badged as verified.
ALTER TABLE "Testimonial" ADD COLUMN "orderId" TEXT;
CREATE INDEX "Testimonial_orderId_idx" ON "Testimonial"("orderId");
ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
