CREATE TABLE "WhatsappLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "WhatsappLog_pkey" PRIMARY KEY ("id")
);
