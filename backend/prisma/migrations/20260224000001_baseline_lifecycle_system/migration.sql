-- ─────────────────────────────────────────────────────────────────────────────
-- BASELINE: tables that existed in the live DB but were never in a migration.
-- NOTE: Foreign key constraints are intentionally omitted here because the
-- referenced tables (User, Device, Client, etc.) are created in earlier
-- migrations. FKs already exist on the live DB; shadow DB gets them via
-- the later migrations that add them explicitly.
-- All CREATE TABLE statements use IF NOT EXISTS for safety.
-- ─────────────────────────────────────────────────────────────────────────────

-- LifecycleRequest
CREATE TABLE IF NOT EXISTS "LifecycleRequest" (
    "id"            SERIAL          NOT NULL,
    "deviceId"      INTEGER,
    "setId"         INTEGER,
    "clientId"      INTEGER,
    "fromStep"      TEXT            NOT NULL,
    "toStep"        TEXT            NOT NULL,
    "healthStatus"  TEXT            NOT NULL DEFAULT 'ok',
    "healthNote"    TEXT,
    "note"          TEXT,
    "requestedById" INTEGER         NOT NULL,
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById"  INTEGER,
    "approvedAt"    TIMESTAMP(3),
    "status"        TEXT            NOT NULL DEFAULT 'pending',
    "rejectionNote" TEXT,
    "autoApproved"  BOOLEAN         NOT NULL DEFAULT false,
    CONSTRAINT "LifecycleRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LifecycleRequest_status_idx"        ON "LifecycleRequest"("status");
CREATE INDEX IF NOT EXISTS "LifecycleRequest_deviceId_idx"      ON "LifecycleRequest"("deviceId");
CREATE INDEX IF NOT EXISTS "LifecycleRequest_setId_idx"         ON "LifecycleRequest"("setId");
CREATE INDEX IF NOT EXISTS "LifecycleRequest_clientId_idx"      ON "LifecycleRequest"("clientId");
CREATE INDEX IF NOT EXISTS "LifecycleRequest_requestedById_idx" ON "LifecycleRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "LifecycleRequest_toStep_idx"        ON "LifecycleRequest"("toStep");
CREATE INDEX IF NOT EXISTS "LifecycleRequest_createdAt_idx"     ON "LifecycleRequest"("createdAt");

-- Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id"        SERIAL          NOT NULL,
    "userId"    INTEGER         NOT NULL,
    "title"     TEXT            NOT NULL,
    "body"      TEXT            NOT NULL,
    "requestId" INTEGER,
    "read"      BOOLEAN         NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type"      TEXT            NOT NULL DEFAULT 'lifecycle',
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "Notification_userId_idx"     ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- DeletionRequest
CREATE TABLE IF NOT EXISTS "DeletionRequest" (
    "id"                SERIAL          NOT NULL,
    "entityType"        TEXT            NOT NULL,
    "entityId"          INTEGER         NOT NULL,
    "entityCode"        TEXT            NOT NULL,
    "snapshot"          JSONB           NOT NULL,
    "componentSnapshot" JSONB,
    "reason"            TEXT            NOT NULL,
    "requestedById"     INTEGER         NOT NULL,
    "requestedByName"   TEXT            NOT NULL,
    "scheduledFor"      TIMESTAMP(3)    NOT NULL,
    "createdAt"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status"            TEXT            NOT NULL DEFAULT 'pending',
    "cancelledById"     INTEGER,
    "cancelledByName"   TEXT,
    "cancelledAt"       TIMESTAMP(3),
    "executedAt"        TIMESTAMP(3),
    "executionNote"     TEXT,
    CONSTRAINT "DeletionRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeletionRequest_status_idx"       ON "DeletionRequest"("status");
CREATE INDEX IF NOT EXISTS "DeletionRequest_entityType_idx"   ON "DeletionRequest"("entityType");
CREATE INDEX IF NOT EXISTS "DeletionRequest_entityId_idx"     ON "DeletionRequest"("entityId");
CREATE INDEX IF NOT EXISTS "DeletionRequest_scheduledFor_idx" ON "DeletionRequest"("scheduledFor");
CREATE INDEX IF NOT EXISTS "DeletionRequest_createdAt_idx"    ON "DeletionRequest"("createdAt");

-- ProductTypeConfig
CREATE TABLE IF NOT EXISTS "ProductTypeConfig" (
    "id"        SERIAL          NOT NULL,
    "typeId"    TEXT            NOT NULL,
    "label"     TEXT            NOT NULL,
    "prefix"    TEXT            NOT NULL,
    "icon"      TEXT            NOT NULL DEFAULT 'Package',
    "color"     TEXT            NOT NULL DEFAULT 'gray',
    "isBuiltin" BOOLEAN         NOT NULL DEFAULT false,
    "isActive"  BOOLEAN         NOT NULL DEFAULT true,
    "sortOrder" INTEGER         NOT NULL DEFAULT 999,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductTypeConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductTypeConfig_typeId_key" ON "ProductTypeConfig"("typeId");
CREATE INDEX IF NOT EXISTS "ProductTypeConfig_typeId_idx"  ON "ProductTypeConfig"("typeId");
CREATE INDEX IF NOT EXISTS "ProductTypeConfig_isActive_idx" ON "ProductTypeConfig"("isActive");

-- SetTypeConfig
CREATE TABLE IF NOT EXISTS "SetTypeConfig" (
    "id"             SERIAL          NOT NULL,
    "setTypeId"      TEXT            NOT NULL,
    "label"          TEXT            NOT NULL,
    "prefix"         TEXT            NOT NULL,
    "icon"           TEXT            NOT NULL DEFAULT 'Layers',
    "color"          TEXT            NOT NULL DEFAULT 'gray',
    "componentSlots" JSONB           NOT NULL DEFAULT '[]',
    "isBuiltin"      BOOLEAN         NOT NULL DEFAULT false,
    "isActive"       BOOLEAN         NOT NULL DEFAULT true,
    "sortOrder"      INTEGER         NOT NULL DEFAULT 999,
    "createdAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetTypeConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SetTypeConfig_setTypeId_key" ON "SetTypeConfig"("setTypeId");
CREATE INDEX IF NOT EXISTS "SetTypeConfig_setTypeId_idx" ON "SetTypeConfig"("setTypeId");

-- CatalogueBrand
CREATE TABLE IF NOT EXISTS "CatalogueBrand" (
    "id"        SERIAL          NOT NULL,
    "name"      TEXT            NOT NULL,
    "isActive"  BOOLEAN         NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueBrand_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogueBrand_name_key" ON "CatalogueBrand"("name");

-- CatalogueSize
CREATE TABLE IF NOT EXISTS "CatalogueSize" (
    "id"        SERIAL          NOT NULL,
    "value"     TEXT            NOT NULL,
    "isActive"  BOOLEAN         NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueSize_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogueSize_value_key" ON "CatalogueSize"("value");

-- CatalogueColor
CREATE TABLE IF NOT EXISTS "CatalogueColor" (
    "id"        SERIAL          NOT NULL,
    "name"      TEXT            NOT NULL,
    "isActive"  BOOLEAN         NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueColor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogueColor_name_key" ON "CatalogueColor"("name");

-- SavedPinpoint
CREATE TABLE IF NOT EXISTS "SavedPinpoint" (
    "id"        SERIAL          NOT NULL,
    "state"     TEXT            NOT NULL,
    "district"  TEXT            NOT NULL,
    "pinpoint"  TEXT            NOT NULL,
    "createdAt" TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedPinpoint_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SavedPinpoint_state_district_pinpoint_key" ON "SavedPinpoint"("state","district","pinpoint");
CREATE INDEX IF NOT EXISTS "SavedPinpoint_state_district_idx" ON "SavedPinpoint"("state","district");

-- InventoryRequest
CREATE TABLE IF NOT EXISTS "InventoryRequest" (
    "id"                SERIAL          NOT NULL,
    "requestedById"     INTEGER         NOT NULL,
    "requestedByName"   TEXT            NOT NULL,
    "createdAt"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestType"       TEXT            NOT NULL,
    "status"            TEXT            NOT NULL DEFAULT 'pending',
    "reviewedById"      INTEGER,
    "reviewedAt"        TIMESTAMP(3),
    "rejectionNote"     TEXT,
    "deviceTypeId"      TEXT,
    "deviceTypeName"    TEXT,
    "quantity"          INTEGER,
    "brand"             TEXT,
    "size"              TEXT,
    "model"             TEXT,
    "color"             TEXT,
    "gpsId"             TEXT,
    "inDate"            TIMESTAMP(3),
    "healthStatus"      TEXT            DEFAULT 'ok',
    "note"              TEXT,
    "setTypeId"         TEXT,
    "setTypeName"       TEXT,
    "setName"           TEXT,
    "reservedDeviceIds" JSONB,
    "targetSetId"       INTEGER,
    "createdDeviceIds"  JSONB,
    "createdSetId"      INTEGER,
    "approvedCodeRange" TEXT,
    "expectedCodeRange" TEXT,
    CONSTRAINT "InventoryRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InventoryRequest_requestedById_idx" ON "InventoryRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "InventoryRequest_status_idx"        ON "InventoryRequest"("status");
CREATE INDEX IF NOT EXISTS "InventoryRequest_requestType_idx"   ON "InventoryRequest"("requestType");
CREATE INDEX IF NOT EXISTS "InventoryRequest_createdAt_idx"     ON "InventoryRequest"("createdAt");

-- ExpenseRequest
CREATE TABLE IF NOT EXISTS "ExpenseRequest" (
    "id"                    SERIAL              NOT NULL,
    "requestedById"         INTEGER             NOT NULL,
    "employeeName"          TEXT                NOT NULL,
    "department"            TEXT                NOT NULL,
    "departmentOther"       TEXT,
    "expenseDate"           TIMESTAMP(3)        NOT NULL,
    "expenseTime"           TEXT,
    "client"                TEXT                NOT NULL,
    "location"              TEXT                NOT NULL,
    "kilometres"            DOUBLE PRECISION,
    "travelReimbursement"   DOUBLE PRECISION,
    "totalAmount"           DOUBLE PRECISION    NOT NULL,
    "status"                TEXT                NOT NULL DEFAULT 'pending',
    "adminComment"          TEXT,
    "approvedById"          INTEGER,
    "approvedAt"            TIMESTAMP(3),
    "rejectedById"          INTEGER,
    "rejectedAt"            TIMESTAMP(3),
    "rejectedReason"        TEXT,
    "reimbursedAt"          TIMESTAMP(3),
    "createdAt"             TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             TIMESTAMP(3)        NOT NULL,
    CONSTRAINT "ExpenseRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExpenseRequest_createdAt_idx"      ON "ExpenseRequest"("createdAt");
CREATE INDEX IF NOT EXISTS "ExpenseRequest_requestedById_idx"  ON "ExpenseRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "ExpenseRequest_status_idx"         ON "ExpenseRequest"("status");

-- ExpenseAttachment
CREATE TABLE IF NOT EXISTS "ExpenseAttachment" (
    "id"               SERIAL  NOT NULL,
    "expenseRequestId" INTEGER NOT NULL,
    "originalName"     TEXT    NOT NULL,
    "storedPath"       TEXT    NOT NULL,
    CONSTRAINT "ExpenseAttachment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExpenseAttachment_expenseRequestId_idx" ON "ExpenseAttachment"("expenseRequestId");

-- ExpenseRequestLine
CREATE TABLE IF NOT EXISTS "ExpenseRequestLine" (
    "id"               SERIAL              NOT NULL,
    "expenseRequestId" INTEGER             NOT NULL,
    "expenseType"      TEXT                NOT NULL,
    "expenseTypeOther" TEXT,
    "description"      TEXT                NOT NULL,
    "amount"           DOUBLE PRECISION    NOT NULL,
    "sortOrder"        INTEGER             NOT NULL DEFAULT 0,
    CONSTRAINT "ExpenseRequestLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExpenseRequestLine_expenseRequestId_idx" ON "ExpenseRequestLine"("expenseRequestId");

-- Warehouse
CREATE TABLE IF NOT EXISTS "Warehouse" (
    "id"            SERIAL          NOT NULL,
    "name"          TEXT            NOT NULL,
    "address"       TEXT,
    "city"          TEXT,
    "state"         TEXT,
    "contactPerson" TEXT,
    "contactPhone"  TEXT,
    "isActive"      BOOLEAN         NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3)    NOT NULL,
    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Warehouse_name_key" ON "Warehouse"("name");

-- WarehouseZone
CREATE TABLE IF NOT EXISTS "WarehouseZone" (
    "id"          SERIAL          NOT NULL,
    "warehouseId" INTEGER         NOT NULL,
    "name"        TEXT            NOT NULL,
    "description" TEXT,
    "isActive"    BOOLEAN         NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WarehouseZone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "WarehouseZone_warehouseId_name_key" ON "WarehouseZone"("warehouseId","name");

-- DeviceLocationHistory
CREATE TABLE IF NOT EXISTS "DeviceLocationHistory" (
    "id"                        SERIAL          NOT NULL,
    "deviceId"                  INTEGER         NOT NULL,
    "warehouseId"               INTEGER,
    "warehouseZone"             TEXT,
    "warehouseSpecificLocation" TEXT,
    "clientId"                  INTEGER,
    "deploymentState"           TEXT,
    "deploymentDistrict"        TEXT,
    "deploymentSite"            TEXT,
    "latitude"                  DECIMAL(10,8),
    "longitude"                 DECIMAL(11,8),
    "googleMapsLink"            TEXT,
    "changedById"               INTEGER,
    "changeReason"              TEXT,
    "notes"                     TEXT,
    "timestamp"                 TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceLocationHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeviceLocationHistory_deviceId_idx"  ON "DeviceLocationHistory"("deviceId");
CREATE INDEX IF NOT EXISTS "DeviceLocationHistory_timestamp_idx" ON "DeviceLocationHistory"("timestamp" DESC);

-- SetLocationHistory
CREATE TABLE IF NOT EXISTS "SetLocationHistory" (
    "id"                        SERIAL          NOT NULL,
    "setId"                     INTEGER,
    "setCode"                   TEXT            NOT NULL,
    "warehouseId"               INTEGER,
    "warehouseZone"             TEXT,
    "warehouseSpecificLocation" TEXT,
    "warehouseName"             TEXT,
    "changedById"               INTEGER,
    "changedByName"             TEXT,
    "changeReason"              TEXT,
    "notes"                     TEXT,
    "timestamp"                 TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SetLocationHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SetLocationHistory_setId_idx"    ON "SetLocationHistory"("setId");
CREATE INDEX IF NOT EXISTS "SetLocationHistory_setCode_idx"  ON "SetLocationHistory"("setCode");
CREATE INDEX IF NOT EXISTS "SetLocationHistory_timestamp_idx" ON "SetLocationHistory"("timestamp" DESC);

-- DisassembledSetLog
CREATE TABLE IF NOT EXISTS "DisassembledSetLog" (
    "id"                        SERIAL          NOT NULL,
    "setCode"                   TEXT            NOT NULL,
    "setTypeName"               TEXT            NOT NULL,
    "setName"                   TEXT,
    "disassembledById"          INTEGER,
    "disassembledByName"        TEXT,
    "requestedById"             INTEGER,
    "requestedByName"           TEXT,
    "reason"                    TEXT            NOT NULL,
    "componentSnapshot"         JSONB           NOT NULL DEFAULT '[]',
    "lifecycleSnapshot"         TEXT,
    "warehouseId"               INTEGER,
    "warehouseZone"             TEXT,
    "warehouseSpecificLocation" TEXT,
    "warehouseName"             TEXT,
    "disassembledAt"            TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisassembledSetLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DisassembledSetLog_setCode_idx"        ON "DisassembledSetLog"("setCode");
CREATE INDEX IF NOT EXISTS "DisassembledSetLog_disassembledAt_idx" ON "DisassembledSetLog"("disassembledAt" DESC);

-- CustomDeploymentLocation
CREATE TABLE IF NOT EXISTS "CustomDeploymentLocation" (
    "id"         SERIAL          NOT NULL,
    "state"      TEXT            NOT NULL,
    "district"   TEXT            NOT NULL,
    "site"       TEXT            NOT NULL,
    "usageCount" INTEGER         NOT NULL DEFAULT 1,
    "lastUsed"   TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"  TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomDeploymentLocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomDeploymentLocation_state_district_site_key" ON "CustomDeploymentLocation"("state","district","site");
CREATE INDEX IF NOT EXISTS "CustomDeploymentLocation_usageCount_lastUsed_idx" ON "CustomDeploymentLocation"("usageCount" DESC, "lastUsed" DESC);

-- WarehouseTransferRequest
CREATE TABLE IF NOT EXISTS "WarehouseTransferRequest" (
    "id"                 SERIAL          NOT NULL,
    "deviceId"           INTEGER,
    "setId"              INTEGER,
    "fromWarehouseId"    INTEGER,
    "toWarehouseId"      INTEGER         NOT NULL,
    "toZone"             TEXT,
    "toSpecificLocation" TEXT,
    "requestedById"      INTEGER         NOT NULL,
    "approvedById"       INTEGER,
    "status"             TEXT            NOT NULL DEFAULT 'pending',
    "notes"              TEXT,
    "createdAt"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt"         TIMESTAMP(3),
    CONSTRAINT "WarehouseTransferRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "WarehouseTransferRequest_status_idx" ON "WarehouseTransferRequest"("status");