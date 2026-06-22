import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { CatalogExtractionService } from './catalog-extraction.service';
import { KnowledgeController } from './knowledge.controller';
import { KnowledgeService } from './knowledge.service';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, EmbeddingService, CatalogExtractionService],
  exports: [KnowledgeService, EmbeddingService],
})
export class KnowledgeModule {}
