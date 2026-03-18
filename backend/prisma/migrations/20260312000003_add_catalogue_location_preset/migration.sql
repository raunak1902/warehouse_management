-- CreateTable: CatalogueLocationPreset
CREATE TABLE IF NOT EXISTS "CatalogueLocationPreset" (
    "id"        SERIAL NOT NULL,
    "name"      TEXT NOT NULL,
    "isActive"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CatalogueLocationPreset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "CatalogueLocationPreset_name_key" ON "CatalogueLocationPreset"("name");
CREATE INDEX IF NOT EXISTS "CatalogueLocationPreset_isActive_idx" ON "CatalogueLocationPreset"("isActive");