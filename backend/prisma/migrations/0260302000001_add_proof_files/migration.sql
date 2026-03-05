-- Migration: add proof_files table for lifecycle request proof uploads

CREATE TABLE "ProofFile" (
  "id"          SERIAL          PRIMARY KEY,
  "requestId"   INTEGER         NOT NULL,
  "fileName"    TEXT            NOT NULL,
  "storedName"  TEXT            NOT NULL,
  "fileType"    TEXT            NOT NULL,
  "mimeType"    TEXT            NOT NULL,
  "sizeKb"      INTEGER         NOT NULL,
  "url"         TEXT            NOT NULL,
  "thumbUrl"    TEXT,
  "createdAt"   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

  CONSTRAINT "ProofFile_requestId_fkey"
    FOREIGN KEY ("requestId")
    REFERENCES "LifecycleRequest"("id")
    ON DELETE CASCADE
);

CREATE INDEX "ProofFile_requestId_idx" ON "ProofFile"("requestId");