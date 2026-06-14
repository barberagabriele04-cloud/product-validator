-- CreateTable
CREATE TABLE "Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productUrl" TEXT,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT,
    "productCogs" REAL,
    "userBudget" REAL NOT NULL,
    "userChannel" TEXT NOT NULL,
    "userMarket" TEXT NOT NULL,
    "userCreativeCapacity" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "errorMessage" TEXT,
    "totalCostEur" REAL,
    "dataIntegrity" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Cache" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
