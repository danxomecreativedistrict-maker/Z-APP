import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KBType } from '@prisma/client';
import { Responded } from '../common/interceptors/response.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUser } from '../auth/auth.types';
import { KnowledgeService } from './knowledge.service';
import {
  CreateKnowledgeDto,
  ImportProductsDto,
  SearchDto,
  UpdateKnowledgeDto,
} from './dto/knowledge.dto';

@Controller('knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Post()
  async create(@CurrentUser() user: PublicUser, @Body() dto: CreateKnowledgeDto) {
    return new Responded(await this.knowledge.create(user.id, dto), 'Élément ajouté.');
  }

  @Get()
  async list(@CurrentUser() user: PublicUser, @Query('type') type?: string) {
    const validType =
      type && (Object.values(KBType) as string[]).includes(type) ? (type as KBType) : undefined;
    return new Responded(
      await this.knowledge.list(user.id, validType),
      'Base de connaissances récupérée.',
    );
  }

  @Post('import-csv')
  @HttpCode(201)
  async importCsv(@CurrentUser() user: PublicUser, @Body() dto: ImportProductsDto) {
    return new Responded(
      await this.knowledge.importProducts(user.id, dto.products),
      'Produits importés.',
    );
  }

  @Post('import-file')
  @UseInterceptors(FileInterceptor('file'))
  async importFile(@CurrentUser() user: PublicUser, @UploadedFile() file: Express.Multer.File) {
    return new Responded(await this.knowledge.importFile(user.id, file), 'Fichier importé.');
  }

  @Post('search')
  @HttpCode(200)
  async search(@CurrentUser() user: PublicUser, @Body() dto: SearchDto) {
    return new Responded(
      await this.knowledge.search(user.id, dto.query, dto.k),
      'Résultats de recherche.',
    );
  }

  @Get(':id')
  async getOne(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return new Responded(await this.knowledge.getOne(user.id, id), 'Élément récupéré.');
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: PublicUser,
    @Param('id') id: string,
    @Body() dto: UpdateKnowledgeDto,
  ) {
    return new Responded(await this.knowledge.update(user.id, id, dto), 'Élément mis à jour.');
  }

  @Delete(':id')
  async remove(@CurrentUser() user: PublicUser, @Param('id') id: string) {
    return new Responded(await this.knowledge.remove(user.id, id), 'Élément supprimé.');
  }
}
