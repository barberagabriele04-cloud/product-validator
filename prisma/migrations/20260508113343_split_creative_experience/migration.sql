/*
  Warnings:

  - You are about to drop the column `userCreativeCapacity` on the `Analysis` table. All the data in the column will be lost.
  - Added the required column `userImageExperience` to the `Analysis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userVideoExperience` to the `Analysis` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Analysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productUrl" TEXT,
    "productName" TEXT NOT NULL,
    "productDescription" TEXT,
    "productCogs" REAL,
    "userBudget" REAL NOT NULL,
    "userChannel" TEXT NOT NULL,
    "userMarket" TEXT NOT NULL,
    "userImageExperience" TEXT NOT NULL,
    "userVideoExperience" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" TEXT,
    "errorMessage" TEXT,
    "totalCostEur" REAL,
    "dataIntegrity" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "completedAt" DATETIME
);
INSERT INTO "new_Analysis" ("completedAt", "createdAt", "dataIntegrity", "errorMessage", "id", "productCogs", "productDescription", "productName", "productUrl", "result", "startedAt", "status", "totalCostEur", "userBudget", "userChannel", "userMarket") SELECT "completedAt", "createdAt", "dataIntegrity", "errorMessage", "id", "productCogs", "productDescription", "productName", "productUrl", "result", "startedAt", "status", "totalCostEur", "userBudget", "userChannel", "userMarket" FROM "Analysis";
DROP TABLE "Analysis";
ALTER TABLE "new_Analysis" RENAME TO "Analysis";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
