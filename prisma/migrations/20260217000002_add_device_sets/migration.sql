-- Migration: Add DeviceSet model and link Device to DeviceSet
-- Folder name: 20260217000002_add_device_sets

-- 1. Create DeviceSet table
CREATE TABLE "DeviceSet" (
  "id"              SERIAL PRIMARY KEY,
  "code"            TEXT NOT NULL UNIQUE,
  "barcode"         TEXT NOT NULL UNIQUE,
  "setType"         TEXT NOT NULL,
  "setTypeName"     TEXT NOT NULL,
  "name"            TEXT,
  "lifecycleStatus" TEXT NOT NULL DEFAULT 'warehouse',
  "healthStatus"    TEXT NOT NULL DEFAULT 'ok',
  "location"        TEXT,
  "state"           TEXT,
  "district"        TEXT,
  "notes"           TEXT,
  "clientId"        INTEGER REFERENCES "Client"("id") ON DELETE SET NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add setId foreign key to Device table
ALTER TABLE "Device" ADD COLUMN IF NOT EXISTS "setId" INTEGER REFERENCES "DeviceSet"("id") ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS "DeviceSet_setType_idx"        ON "DeviceSet"("setType");
CREATE INDEX IF NOT EXISTS "DeviceSet_lifecycleStatus_idx" ON "DeviceSet"("lifecycleStatus");
CREATE INDEX IF NOT EXISTS "DeviceSet_clientId_idx"        ON "DeviceSet"("clientId");
CREATE INDEX IF NOT EXISTS "DeviceSet_barcode_idx"         ON "DeviceSet"("barcode");
CREATE INDEX IF NOT EXISTS "Device_setId_idx"              ON "Device"("setId");

-- 4. Auto-update updatedAt trigger for DeviceSet
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_device_set_updated_at
  BEFORE UPDATE ON "DeviceSet"
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();