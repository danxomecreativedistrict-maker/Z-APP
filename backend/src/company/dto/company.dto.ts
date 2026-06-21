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

// Numéro vide accepté, sinon format international souple : +indicatif puis 8 à 20 chiffres
// (espaces/tirets tolérés). Évite d'enregistrer des numéros que WhatsApp ne pourra pas joindre.
export const PHONE_REGEX = /^$|^\+?\d[\d\s-]{6,18}\d$/;
const PHONE_MESSAGE = 'Numéro invalide (format international, ex : +229 97 00 00 00).';

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
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
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
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  ownerPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
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
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  alertPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  delivererPhone?: string;

  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Heure invalide (format HH:MM).' })
  dailySummaryTime?: string;

  @IsOptional()
  @IsBoolean()
  dailySummaryOn?: boolean;
}
