-- Optional storefront testimonials section, off by default so no boutique's
-- public site changes until its admin turns it on and adds at least one
-- entry. Testimonial mirrors SocialLink/WalletAccount: same RLS + public
-- read policy (needed on the storefront, not just admin).
ALTER TABLE "StoreType" ADD COLUMN "testimonialsEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "Testimonial" (
    "id" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "rating" INTEGER,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Testimonial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Testimonial_productType_idx" ON "Testimonial"("productType");

ALTER TABLE "Testimonial" ADD CONSTRAINT "Testimonial_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Testimonial" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON "Testimonial" FOR SELECT TO anon, authenticated USING (true);
