/*
  Warnings:

  - The `embedding` column on the `KnowledgeItem` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "KnowledgeItem" DROP COLUMN "embedding",
ADD COLUMN     "embedding" vector(1536);
