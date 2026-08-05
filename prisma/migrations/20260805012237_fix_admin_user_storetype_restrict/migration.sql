-- DropForeignKey
ALTER TABLE "AdminUser" DROP CONSTRAINT "AdminUser_productType_fkey";

-- AddForeignKey
ALTER TABLE "AdminUser" ADD CONSTRAINT "AdminUser_productType_fkey" FOREIGN KEY ("productType") REFERENCES "StoreType"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
