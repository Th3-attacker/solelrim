-- DropForeignKey
ALTER TABLE "AdminUser" DROP CONSTRAINT "AdminUser_productType_fkey";

-- AlterTable
ALTER TABLE "StoreType" ADD COLUMN     "heroSubtitleAr" TEXT,
ADD COLUMN     "heroTitleAr" TEXT,
ADD COLUMN     "seoDescriptionAr" TEXT,
ADD COLUMN     "seoTitleAr" TEXT,
ADD COLUMN     "siteNameAr" TEXT;

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE SET NULL ON UPDATE CASCADE;
