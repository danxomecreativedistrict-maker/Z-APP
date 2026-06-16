import { KBType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateKnowledgeDto {
  @IsEnum(KBType, { message: 'Type invalide (PRODUCT, FAQ, POLICY, SCRIPT, DOCUMENT).' })
  type!: KBType;

  @IsString()
  @MinLength(1, { message: 'Le titre est requis.' })
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(1, { message: 'Le contenu est requis.' })
  @MaxLength(8000)
  content!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  sourceFile?: string;
}

export class UpdateKnowledgeDto {
  @IsOptional()
  @IsEnum(KBType)
  type?: KBType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content?: string;
}

export class ProductRowDto {
  @IsString()
  @MinLength(1, { message: 'Le nom du produit est requis.' })
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  unit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;
}

export class ImportProductsDto {
  @ValidateNested({ each: true })
  @Type(() => ProductRowDto)
  @ArrayMinSize(1, { message: 'Aucun produit à importer.' })
  @ArrayMaxSize(500, { message: 'Maximum 500 produits par import.' })
  products!: ProductRowDto[];
}

export class SearchDto {
  @IsString()
  @MinLength(1, { message: 'La requête est requise.' })
  @MaxLength(500)
  query!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  k?: number;
}
