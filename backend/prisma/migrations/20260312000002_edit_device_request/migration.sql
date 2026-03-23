-- AddColumn: targetDeviceId for edit_device requests
ALTER TABLE "InventoryRequest" ADD COLUMN IF NOT EXISTS "targetDeviceId"    INTEGER;
ALTER TABLE "InventoryRequest" ADD COLUMN IF NOT EXISTS "targetDeviceCode"  TEXT;
ALTER TABLE "InventoryRequest" ADD COLUMN IF NOT EXISTS "proposedChanges"   JSONB;

-- AddColumn: timestamp to DeviceLocationHistory (in case it's missing)
ALTER TABLE "DeviceLocationHistory" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- FK for targetDeviceId (guarded so it's safe on both fresh and existing DBs)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InventoryRequest_targetDeviceId_fkey') THEN
    ALTER TABLE "InventoryRequest"
      ADD CONSTRAINT "InventoryRequest_targetDeviceId_fkey"
      FOREIGN KEY ("targetDeviceId") REFERENCES "Device"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Index for efficient device-specific edit request lookup
CREATE INDEX IF NOT EXISTS "InventoryRequest_targetDeviceId_idx" ON "InventoryRequest"("targetDeviceId");