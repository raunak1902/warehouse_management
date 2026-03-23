-- Baseline: create InventoryRequest table (existed in DB but was missing from migrations)
CREATE TABLE IF NOT EXISTS "InventoryRequest" (
    "id"                      SERIAL NOT NULL,
    "requestedById"           INTEGER NOT NULL,
    "requestedByName"         TEXT NOT NULL,
    "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestType"             TEXT NOT NULL,
    "status"                  TEXT NOT NULL DEFAULT 'pending',
    "reviewedById"            INTEGER,
    "reviewedAt"              TIMESTAMP(3),
    "rejectionNote"           TEXT,
    "deviceTypeId"            TEXT,
    "deviceTypeName"          TEXT,
    "quantity"                INTEGER,
    "brand"                   TEXT,
    "size"                    TEXT,
    "model"                   TEXT,
    "color"                   TEXT,
    "gpsId"                   TEXT,
    "inDate"                  TIMESTAMP(3),
    "healthStatus"            TEXT DEFAULT 'ok',
    "note"                    TEXT,
    "setTypeId"               TEXT,
    "setTypeName"             TEXT,
    "setName"                 TEXT,
    "reservedDeviceIds"       JSONB,
    "targetSetId"             INTEGER,
    "createdDeviceIds"        JSONB,
    "createdSetId"            INTEGER,
    "approvedCodeRange"       TEXT,
    "expectedCodeRange"       TEXT,

    CONSTRAINT "InventoryRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryRequest_requestedById_idx" ON "InventoryRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "InventoryRequest_status_idx"        ON "InventoryRequest"("status");
CREATE INDEX IF NOT EXISTS "InventoryRequest_requestType_idx"   ON "InventoryRequest"("requestType");
CREATE INDEX IF NOT EXISTS "InventoryRequest_createdAt_idx"     ON "InventoryRequest"("createdAt");