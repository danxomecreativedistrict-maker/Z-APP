import { Module } from '@nestjs/common';
import { UploadthingModule } from '../uploadthing/uploadthing.module';
import { CompanyController } from './company.controller';
import { CompanyService } from './company.service';

@Module({
  imports: [UploadthingModule],
  controllers: [CompanyController],
  providers: [CompanyService],
})
export class CompanyModule {}
