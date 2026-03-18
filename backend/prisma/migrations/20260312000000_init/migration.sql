-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" INTEGER NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" SERIAL NOT NULL,
    "module" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" INTEGER NOT NULL,
    "permissionId" INTEGER NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "brand" TEXT,
    "size" TEXT,
    "model" TEXT,
    "color" TEXT,
    "gpsId" TEXT,
    "mfgDate" TIMESTAMP(3),
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'available',
    "location" TEXT,
    "state" TEXT,
    "district" TEXT,
    "pinpoint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" INTEGER,
    "healthStatus" TEXT NOT NULL DEFAULT 'ok',
    "setId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "barcode" TEXT NOT NULL,
    "deployedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "requestedAt" TIMESTAMP(3),
    "requestedById" INTEGER,
    "subscriptionEndDate" TIMESTAMP(3),
    "warehouseId" INTEGER,
    "warehouseZone" TEXT,
    "warehouseSpecificLocation" TEXT,
    "deploymentState" TEXT,
    "deploymentDistrict" TEXT,
    "deploymentSite" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "googleMapsLink" TEXT,
    "returnDate" TIMESTAMP(3),
    "assignmentHealth" TEXT,
    "assignmentHealthNote" TEXT,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceSet" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "barcode" TEXT NOT NULL,
    "setType" TEXT NOT NULL,
    "setTypeName" TEXT NOT NULL,
    "name" TEXT,
    "lifecycleStatus" TEXT NOT NULL DEFAULT 'available',
    "healthStatus" TEXT NOT NULL DEFAULT 'ok',
    "location" TEXT,
    "state" TEXT,
    "district" TEXT,
    "notes" TEXT,
    "clientId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "rejectionNote" TEXT,
    "requestedAt" TIMESTAMP(3),
    "requestedById" INTEGER,
    "subscriptionEndDate" TIMESTAMP(3),
    "warehouseId" INTEGER,
    "warehouseZone" TEXT,
    "warehouseSpecificLocation" TEXT,

    CONSTRAINT "DeviceSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LifecycleRequest" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER,
    "setId" INTEGER,
    "clientId" INTEGER,
    "fromStep" TEXT NOT NULL,
    "toStep" TEXT NOT NULL,
    "healthStatus" TEXT NOT NULL DEFAULT 'ok',
    "healthNote" TEXT,
    "note" TEXT,
    "requestedById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "rejectionNote" TEXT,
    "autoApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LifecycleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "requestId" INTEGER,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL DEFAULT 'lifecycle',

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceHistory" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "fromStatus" TEXT NOT NULL,
    "toStatus" TEXT NOT NULL,
    "changedById" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "DeviceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentRequest" (
    "id" SERIAL NOT NULL,
    "requestType" TEXT NOT NULL,
    "deviceId" INTEGER,
    "setId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "healthStatus" TEXT NOT NULL DEFAULT 'ok',
    "healthComment" TEXT,
    "returnType" TEXT NOT NULL,
    "returnDays" INTEGER,
    "returnMonths" INTEGER,
    "returnDate" TIMESTAMP(3),
    "computedReturnDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" INTEGER,
    "approvedBy" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRequest" (
    "id" SERIAL NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "deviceId" INTEGER,
    "setId" INTEGER,
    "requestType" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "adminNote" TEXT,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRequestComment" (
    "id" SERIAL NOT NULL,
    "teamRequestId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "authorRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "authorName" TEXT NOT NULL,

    CONSTRAINT "TeamRequestComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProofFile" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeKb" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbUrl" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProofFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeletionRequest" (
    "id" SERIAL NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" INTEGER NOT NULL,
    "entityCode" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "componentSnapshot" JSONB,
    "reason" TEXT NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cancelledById" INTEGER,
    "cancelledByName" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "executionNote" TEXT,

    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionReminder" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER,
    "setId" INTEGER,
    "reminderType" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attendedAt" TIMESTAMP(3),

    CONSTRAINT "SubscriptionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductTypeConfig" (
    "id" SERIAL NOT NULL,
    "typeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Package',
    "color" TEXT NOT NULL DEFAULT 'gray',
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 999,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetTypeConfig" (
    "id" SERIAL NOT NULL,
    "setTypeId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Layers',
    "color" TEXT NOT NULL DEFAULT 'gray',
    "componentSlots" JSONB NOT NULL DEFAULT '[]',
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 999,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SetTypeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueBrand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueSize" (
    "id" SERIAL NOT NULL,
    "value" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogueColor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogueColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedPinpoint" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "pinpoint" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedPinpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryRequest" (
    "id" SERIAL NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewedById" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "deviceTypeId" TEXT,
    "deviceTypeName" TEXT,
    "quantity" INTEGER,
    "brand" TEXT,
    "size" TEXT,
    "model" TEXT,
    "color" TEXT,
    "gpsId" TEXT,
    "inDate" TIMESTAMP(3),
    "healthStatus" TEXT DEFAULT 'ok',
    "note" TEXT,
    "setTypeId" TEXT,
    "setTypeName" TEXT,
    "setName" TEXT,
    "reservedDeviceIds" JSONB,
    "targetSetId" INTEGER,
    "createdDeviceIds" JSONB,
    "createdSetId" INTEGER,
    "approvedCodeRange" TEXT,
    "expectedCodeRange" TEXT,

    CONSTRAINT "InventoryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseAttachment" (
    "id" SERIAL NOT NULL,
    "expenseRequestId" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "storedPath" TEXT NOT NULL,

    CONSTRAINT "ExpenseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRequest" (
    "id" SERIAL NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "departmentOther" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "expenseTime" TEXT,
    "client" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "kilometres" DOUBLE PRECISION,
    "travelReimbursement" DOUBLE PRECISION,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "adminComment" TEXT,
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" INTEGER,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "reimbursedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseRequestLine" (
    "id" SERIAL NOT NULL,
    "expenseRequestId" INTEGER NOT NULL,
    "expenseType" TEXT NOT NULL,
    "expenseTypeOther" TEXT,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "contactPerson" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseZone" (
    "id" SERIAL NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceLocationHistory" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER NOT NULL,
    "warehouseId" INTEGER,
    "warehouseZone" TEXT,
    "warehouseSpecificLocation" TEXT,
    "clientId" INTEGER,
    "deploymentState" TEXT,
    "deploymentDistrict" TEXT,
    "deploymentSite" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "googleMapsLink" TEXT,
    "changedById" INTEGER,
    "changeReason" TEXT,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceLocationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomDeploymentLocation" (
    "id" SERIAL NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "usageCount" INTEGER NOT NULL DEFAULT 1,
    "lastUsed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomDeploymentLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarehouseTransferRequest" (
    "id" SERIAL NOT NULL,
    "deviceId" INTEGER,
    "setId" INTEGER,
    "fromWarehouseId" INTEGER,
    "toWarehouseId" INTEGER NOT NULL,
    "toZone" TEXT,
    "toSpecificLocation" TEXT,
    "requestedById" INTEGER NOT NULL,
    "approvedById" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "WarehouseTransferRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_module_operation_key" ON "Permission"("module", "operation");

-- CreateIndex
CREATE UNIQUE INDEX "Device_code_key" ON "Device"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Device_barcode_key" ON "Device"("barcode");

-- CreateIndex
CREATE INDEX "Device_type_idx" ON "Device"("type");

-- CreateIndex
CREATE INDEX "Device_lifecycleStatus_idx" ON "Device"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "Device_clientId_idx" ON "Device"("clientId");

-- CreateIndex
CREATE INDEX "Device_code_idx" ON "Device"("code");

-- CreateIndex
CREATE INDEX "Device_barcode_idx" ON "Device"("barcode");

-- CreateIndex
CREATE INDEX "Device_setId_idx" ON "Device"("setId");

-- CreateIndex
CREATE INDEX "Device_warehouseId_idx" ON "Device"("warehouseId");

-- CreateIndex
CREATE INDEX "Device_deploymentState_idx" ON "Device"("deploymentState");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSet_code_key" ON "DeviceSet"("code");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceSet_barcode_key" ON "DeviceSet"("barcode");

-- CreateIndex
CREATE INDEX "DeviceSet_setType_idx" ON "DeviceSet"("setType");

-- CreateIndex
CREATE INDEX "DeviceSet_lifecycleStatus_idx" ON "DeviceSet"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "DeviceSet_clientId_idx" ON "DeviceSet"("clientId");

-- CreateIndex
CREATE INDEX "DeviceSet_barcode_idx" ON "DeviceSet"("barcode");

-- CreateIndex
CREATE INDEX "LifecycleRequest_status_idx" ON "LifecycleRequest"("status");

-- CreateIndex
CREATE INDEX "LifecycleRequest_deviceId_idx" ON "LifecycleRequest"("deviceId");

-- CreateIndex
CREATE INDEX "LifecycleRequest_setId_idx" ON "LifecycleRequest"("setId");

-- CreateIndex
CREATE INDEX "LifecycleRequest_clientId_idx" ON "LifecycleRequest"("clientId");

-- CreateIndex
CREATE INDEX "LifecycleRequest_requestedById_idx" ON "LifecycleRequest"("requestedById");

-- CreateIndex
CREATE INDEX "LifecycleRequest_toStep_idx" ON "LifecycleRequest"("toStep");

-- CreateIndex
CREATE INDEX "LifecycleRequest_createdAt_idx" ON "LifecycleRequest"("createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "DeviceHistory_deviceId_idx" ON "DeviceHistory"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceHistory_deviceId_changedAt_idx" ON "DeviceHistory"("deviceId", "changedAt");

-- CreateIndex
CREATE INDEX "AssignmentRequest_status_idx" ON "AssignmentRequest"("status");

-- CreateIndex
CREATE INDEX "AssignmentRequest_clientId_idx" ON "AssignmentRequest"("clientId");

-- CreateIndex
CREATE INDEX "AssignmentRequest_deviceId_idx" ON "AssignmentRequest"("deviceId");

-- CreateIndex
CREATE INDEX "AssignmentRequest_setId_idx" ON "AssignmentRequest"("setId");

-- CreateIndex
CREATE INDEX "TeamRequest_status_idx" ON "TeamRequest"("status");

-- CreateIndex
CREATE INDEX "TeamRequest_requestedById_idx" ON "TeamRequest"("requestedById");

-- CreateIndex
CREATE INDEX "TeamRequest_deviceId_idx" ON "TeamRequest"("deviceId");

-- CreateIndex
CREATE INDEX "TeamRequest_setId_idx" ON "TeamRequest"("setId");

-- CreateIndex
CREATE INDEX "TeamRequestComment_teamRequestId_idx" ON "TeamRequestComment"("teamRequestId");

-- CreateIndex
CREATE INDEX "ProofFile_requestId_idx" ON "ProofFile"("requestId");

-- CreateIndex
CREATE INDEX "DeletionRequest_status_idx" ON "DeletionRequest"("status");

-- CreateIndex
CREATE INDEX "DeletionRequest_entityType_idx" ON "DeletionRequest"("entityType");

-- CreateIndex
CREATE INDEX "DeletionRequest_entityId_idx" ON "DeletionRequest"("entityId");

-- CreateIndex
CREATE INDEX "DeletionRequest_scheduledFor_idx" ON "DeletionRequest"("scheduledFor");

-- CreateIndex
CREATE INDEX "DeletionRequest_createdAt_idx" ON "DeletionRequest"("createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionReminder_deviceId_idx" ON "SubscriptionReminder"("deviceId");

-- CreateIndex
CREATE INDEX "SubscriptionReminder_setId_idx" ON "SubscriptionReminder"("setId");

-- CreateIndex
CREATE INDEX "SubscriptionReminder_attended_idx" ON "SubscriptionReminder"("attended");

-- CreateIndex
CREATE UNIQUE INDEX "ProductTypeConfig_typeId_key" ON "ProductTypeConfig"("typeId");

-- CreateIndex
CREATE INDEX "ProductTypeConfig_typeId_idx" ON "ProductTypeConfig"("typeId");

-- CreateIndex
CREATE INDEX "ProductTypeConfig_isActive_idx" ON "ProductTypeConfig"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "SetTypeConfig_setTypeId_key" ON "SetTypeConfig"("setTypeId");

-- CreateIndex
CREATE INDEX "SetTypeConfig_setTypeId_idx" ON "SetTypeConfig"("setTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueBrand_name_key" ON "CatalogueBrand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueSize_value_key" ON "CatalogueSize"("value");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogueColor_name_key" ON "CatalogueColor"("name");

-- CreateIndex
CREATE INDEX "SavedPinpoint_state_district_idx" ON "SavedPinpoint"("state", "district");

-- CreateIndex
CREATE UNIQUE INDEX "SavedPinpoint_state_district_pinpoint_key" ON "SavedPinpoint"("state", "district", "pinpoint");

-- CreateIndex
CREATE INDEX "InventoryRequest_requestedById_idx" ON "InventoryRequest"("requestedById");

-- CreateIndex
CREATE INDEX "InventoryRequest_status_idx" ON "InventoryRequest"("status");

-- CreateIndex
CREATE INDEX "InventoryRequest_requestType_idx" ON "InventoryRequest"("requestType");

-- CreateIndex
CREATE INDEX "InventoryRequest_createdAt_idx" ON "InventoryRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ExpenseAttachment_expenseRequestId_idx" ON "ExpenseAttachment"("expenseRequestId");

-- CreateIndex
CREATE INDEX "ExpenseRequest_createdAt_idx" ON "ExpenseRequest"("createdAt");

-- CreateIndex
CREATE INDEX "ExpenseRequest_requestedById_idx" ON "ExpenseRequest"("requestedById");

-- CreateIndex
CREATE INDEX "ExpenseRequest_status_idx" ON "ExpenseRequest"("status");

-- CreateIndex
CREATE INDEX "ExpenseRequestLine_expenseRequestId_idx" ON "ExpenseRequestLine"("expenseRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_name_key" ON "Warehouse"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WarehouseZone_warehouseId_name_key" ON "WarehouseZone"("warehouseId", "name");

-- CreateIndex
CREATE INDEX "DeviceLocationHistory_deviceId_idx" ON "DeviceLocationHistory"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceLocationHistory_timestamp_idx" ON "DeviceLocationHistory"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "CustomDeploymentLocation_usageCount_lastUsed_idx" ON "CustomDeploymentLocation"("usageCount" DESC, "lastUsed" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "CustomDeploymentLocation_state_district_site_key" ON "CustomDeploymentLocation"("state", "district", "site");

-- CreateIndex
CREATE INDEX "WarehouseTransferRequest_status_idx" ON "WarehouseTransferRequest"("status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_setId_fkey" FOREIGN KEY ("setId") REFERENCES "DeviceSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSet" ADD CONSTRAINT "DeviceSet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceSet" ADD CONSTRAINT "DeviceSet_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LifecycleRequest" ADD CONSTRAINT "LifecycleRequest_setId_fkey" FOREIGN KEY ("setId") REFERENCES "DeviceSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceHistory" ADD CONSTRAINT "DeviceHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRequestComment" ADD CONSTRAINT "TeamRequestComment_teamRequestId_fkey" FOREIGN KEY ("teamRequestId") REFERENCES "TeamRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProofFile" ADD CONSTRAINT "ProofFile_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "LifecycleRequest"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ExpenseAttachment" ADD CONSTRAINT "ExpenseAttachment_expenseRequestId_fkey" FOREIGN KEY ("expenseRequestId") REFERENCES "ExpenseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRequest" ADD CONSTRAINT "ExpenseRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseRequestLine" ADD CONSTRAINT "ExpenseRequestLine_expenseRequestId_fkey" FOREIGN KEY ("expenseRequestId") REFERENCES "ExpenseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseZone" ADD CONSTRAINT "WarehouseZone_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLocationHistory" ADD CONSTRAINT "DeviceLocationHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLocationHistory" ADD CONSTRAINT "DeviceLocationHistory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLocationHistory" ADD CONSTRAINT "DeviceLocationHistory_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceLocationHistory" ADD CONSTRAINT "DeviceLocationHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferRequest" ADD CONSTRAINT "WarehouseTransferRequest_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferRequest" ADD CONSTRAINT "WarehouseTransferRequest_setId_fkey" FOREIGN KEY ("setId") REFERENCES "DeviceSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferRequest" ADD CONSTRAINT "WarehouseTransferRequest_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferRequest" ADD CONSTRAINT "WarehouseTransferRequest_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferRequest" ADD CONSTRAINT "WarehouseTransferRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarehouseTransferRequest" ADD CONSTRAINT "WarehouseTransferRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

