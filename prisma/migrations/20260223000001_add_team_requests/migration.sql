-- CreateTable
CREATE TABLE "TeamRequest" (
    "id" SERIAL NOT NULL,
    "requestedById" INTEGER NOT NULL,
    "deviceId" INTEGER,
    "setId" INTEGER,
    "requestType" TEXT NOT NULL,
    "changes" JSONB NOT NULL DEFAULT '[]',
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

-- CreateIndex
CREATE INDEX "TeamRequest_status_idx" ON "TeamRequest"("status");
CREATE INDEX "TeamRequest_requestedById_idx" ON "TeamRequest"("requestedById");
CREATE INDEX "TeamRequest_deviceId_idx" ON "TeamRequest"("deviceId");
CREATE INDEX "TeamRequest_setId_idx" ON "TeamRequest"("setId");
CREATE INDEX "TeamRequestComment_teamRequestId_idx" ON "TeamRequestComment"("teamRequestId");

-- AddForeignKey
ALTER TABLE "TeamRequestComment" ADD CONSTRAINT "TeamRequestComment_teamRequestId_fkey" 
    FOREIGN KEY ("teamRequestId") REFERENCES "TeamRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
