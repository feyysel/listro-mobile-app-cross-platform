-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'DELIVERY', 'OPERATOR', 'MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'CONFIRMED', 'DELIVERY_ASSIGNED', 'PICKUP_IN_PROGRESS', 'RECEIVED_AT_CENTER', 'WASHING_IN_PROGRESS', 'WASHING_COMPLETED', 'READY_FOR_DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('PICKUP', 'RETURN');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WashingStatus" AS ENUM ('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TELEBIRR', 'CBE_BIRR', 'BANK_TRANSFER', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "hireDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "subCity" TEXT,
    "woreda" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchEmployee" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchEmployee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Address" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "label" TEXT,
    "recipientName" TEXT,
    "phone" TEXT,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "subCity" TEXT,
    "woreda" TEXT,
    "houseNumber" TEXT,
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Address_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shoe" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "referencePhoto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shoe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "estimatedDurationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchService" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "bookingCode" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "branchId" TEXT,
    "pickupAddressId" TEXT NOT NULL,
    "returnAddressId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "customerNotes" TEXT,
    "internalNotes" TEXT,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shoeId" TEXT,
    "branchServiceId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "totalPrice" DECIMAL(12,2) NOT NULL,
    "shoeBrand" TEXT,
    "shoeModel" TEXT,
    "shoeCategory" TEXT NOT NULL,
    "shoeColor" TEXT,
    "conditionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "employeeId" TEXT,
    "addressId" TEXT,
    "type" "DeliveryType" NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WashingTask" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "operatorId" TEXT,
    "status" "WashingStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "instructions" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WashingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoeInspection" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "inspectorId" TEXT,
    "conditionBefore" TEXT,
    "conditionAfter" TEXT,
    "notes" TEXT,
    "beforePhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "afterPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "inspectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoeInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "recordedByUserId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "transactionReference" TEXT,
    "providerReference" TEXT,
    "notes" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "changedByUserId" TEXT,
    "previousStatus" "OrderStatus",
    "newStatus" "OrderStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT,
    "data" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_role_status_idx" ON "User"("role", "status");

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_userId_key" ON "Customer"("userId");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_status_idx" ON "Employee"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_status_idx" ON "Branch"("status");

-- CreateIndex
CREATE INDEX "Branch_city_idx" ON "Branch"("city");

-- CreateIndex
CREATE INDEX "BranchEmployee_employeeId_idx" ON "BranchEmployee"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchEmployee_branchId_employeeId_key" ON "BranchEmployee"("branchId", "employeeId");

-- CreateIndex
CREATE INDEX "Address_customerId_idx" ON "Address"("customerId");

-- CreateIndex
CREATE INDEX "Shoe_customerId_idx" ON "Shoe"("customerId");

-- CreateIndex
CREATE INDEX "Service_isActive_idx" ON "Service"("isActive");

-- CreateIndex
CREATE INDEX "BranchService_serviceId_idx" ON "BranchService"("serviceId");

-- CreateIndex
CREATE INDEX "BranchService_branchId_isActive_idx" ON "BranchService"("branchId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BranchService_branchId_serviceId_key" ON "BranchService"("branchId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_bookingCode_key" ON "Order"("bookingCode");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_branchId_status_idx" ON "Order"("branchId", "status");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_bookingCode_idx" ON "Order"("bookingCode");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_branchServiceId_idx" ON "OrderItem"("branchServiceId");

-- CreateIndex
CREATE INDEX "OrderItem_shoeId_idx" ON "OrderItem"("shoeId");

-- CreateIndex
CREATE INDEX "Delivery_employeeId_status_idx" ON "Delivery"("employeeId", "status");

-- CreateIndex
CREATE INDEX "Delivery_branchId_status_idx" ON "Delivery"("branchId", "status");

-- CreateIndex
CREATE INDEX "Delivery_scheduledAt_idx" ON "Delivery"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Delivery_orderId_type_key" ON "Delivery"("orderId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "WashingTask_orderItemId_key" ON "WashingTask"("orderItemId");

-- CreateIndex
CREATE INDEX "WashingTask_branchId_status_idx" ON "WashingTask"("branchId", "status");

-- CreateIndex
CREATE INDEX "WashingTask_operatorId_status_idx" ON "WashingTask"("operatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShoeInspection_orderItemId_key" ON "ShoeInspection"("orderItemId");

-- CreateIndex
CREATE INDEX "ShoeInspection_inspectorId_idx" ON "ShoeInspection"("inspectorId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_transactionReference_key" ON "Payment"("transactionReference");

-- CreateIndex
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_changedByUserId_idx" ON "OrderStatusHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchEmployee" ADD CONSTRAINT "BranchEmployee_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchEmployee" ADD CONSTRAINT "BranchEmployee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Address" ADD CONSTRAINT "Address_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shoe" ADD CONSTRAINT "Shoe_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchService" ADD CONSTRAINT "BranchService_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BranchService" ADD CONSTRAINT "BranchService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_pickupAddressId_fkey" FOREIGN KEY ("pickupAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_returnAddressId_fkey" FOREIGN KEY ("returnAddressId") REFERENCES "Address"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_shoeId_fkey" FOREIGN KEY ("shoeId") REFERENCES "Shoe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_branchServiceId_fkey" FOREIGN KEY ("branchServiceId") REFERENCES "BranchService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashingTask" ADD CONSTRAINT "WashingTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashingTask" ADD CONSTRAINT "WashingTask_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashingTask" ADD CONSTRAINT "WashingTask_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WashingTask" ADD CONSTRAINT "WashingTask_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoeInspection" ADD CONSTRAINT "ShoeInspection_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoeInspection" ADD CONSTRAINT "ShoeInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
