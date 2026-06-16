import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCompanyDto {
  @IsString()
  @MinLength(2, { message: "Le nom de l'entreprise est requis (2 caractères minimum)." })
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  managerPhone?: string;
}

export class UpdateCompanyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  sector?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  managerPhone?: string;
}

export class UpdateNovaDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  novaName?: string;

  @IsOptional()
  @IsIn(['formal', 'semi-formal', 'casual'], {
    message: 'Ton invalide (formal, semi-formal ou casual).',
  })
  novaTone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  novaLanguage?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  welcomeMessage?: string;
}

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  @MaxLength(1500)
  deliveryPolicy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1500)
  paymentPolicy?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  deliveryZones?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveryDelay?: string;
}

export class UpdateNotificationsDto {
  @IsOptional()
  @IsString()
  @MaxLength(30)
  alertPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  delivererPhone?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure invalide (format HH:MM).' })
  dailySummaryTime?: string;

  @IsOptional()
  @IsBoolean()
  dailySummaryOn?: boolean;
}
