import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Responded } from '../common/interceptors/response.interceptor';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PublicUser } from '../auth/auth.types';
import { CompanyService } from './company.service';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  UpdateNotificationsDto,
  UpdateNovaDto,
  UpdatePolicyDto,
} from './dto/company.dto';

@Controller('company')
@UseGuards(JwtAuthGuard)
export class CompanyController {
  constructor(private readonly company: CompanyService) {}

  @Post()
  async create(@CurrentUser() user: PublicUser, @Body() dto: CreateCompanyDto) {
    return new Responded(await this.company.create(user.id, dto), 'Fiche entreprise créée.');
  }

  @Get('me')
  async getMine(@CurrentUser() user: PublicUser) {
    return new Responded(await this.company.getMine(user.id), 'Fiche entreprise récupérée.');
  }

  @Patch('me')
  async update(@CurrentUser() user: PublicUser, @Body() dto: UpdateCompanyDto) {
    return new Responded(await this.company.update(user.id, dto), 'Fiche entreprise mise à jour.');
  }

  @Get('me/nova')
  async getNova(@CurrentUser() user: PublicUser) {
    return new Responded(await this.company.getNova(user.id), 'Configuration NOVA récupérée.');
  }

  @Patch('me/nova')
  async updateNova(@CurrentUser() user: PublicUser, @Body() dto: UpdateNovaDto) {
    return new Responded(
      await this.company.updateNova(user.id, dto),
      'Configuration NOVA mise à jour.',
    );
  }

  @Patch('me/policy')
  async updatePolicy(@CurrentUser() user: PublicUser, @Body() dto: UpdatePolicyDto) {
    return new Responded(
      await this.company.updatePolicy(user.id, dto),
      'Politique commerciale mise à jour.',
    );
  }

  @Patch('me/notifications')
  async updateNotifications(@CurrentUser() user: PublicUser, @Body() dto: UpdateNotificationsDto) {
    return new Responded(
      await this.company.updateNotifications(user.id, dto),
      'Notifications mises à jour.',
    );
  }

  @Post('me/onboarding-done')
  async completeOnboarding(@CurrentUser() user: PublicUser) {
    return new Responded(await this.company.completeOnboarding(user.id), 'Onboarding terminé.');
  }

  @Post('me/logo')
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(@CurrentUser() user: PublicUser, @UploadedFile() file: Express.Multer.File) {
    return new Responded(await this.company.uploadLogo(user.id, file), 'Logo mis à jour.');
  }
}
