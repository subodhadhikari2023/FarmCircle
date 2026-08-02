-- CreateIndex
CREATE INDEX "Listing_ownerId_idx" ON "Listing"("ownerId");

-- CreateIndex
CREATE INDEX "Order_buyerId_idx" ON "Order"("buyerId");

-- CreateIndex
CREATE INDEX "Order_listingId_idx" ON "Order"("listingId");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Payment_razorpayOrderId_idx" ON "Payment"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "PreBooking_vendorId_idx" ON "PreBooking"("vendorId");

-- CreateIndex
CREATE INDEX "PreBooking_batchId_idx" ON "PreBooking"("batchId");

-- CreateIndex
CREATE INDEX "PreBooking_status_idx" ON "PreBooking"("status");
