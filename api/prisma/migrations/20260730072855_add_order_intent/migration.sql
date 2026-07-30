-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "orderIntentId" TEXT;

-- CreateTable
CREATE TABLE "OrderIntent" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "deliveryMethod" "DeliveryMethod" NOT NULL,
    "addressId" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderIntentId_key" ON "Payment"("orderIntentId");

-- AddForeignKey
ALTER TABLE "OrderIntent" ADD CONSTRAINT "OrderIntent_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderIntent" ADD CONSTRAINT "OrderIntent_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderIntent" ADD CONSTRAINT "OrderIntent_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderIntentId_fkey" FOREIGN KEY ("orderIntentId") REFERENCES "OrderIntent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

