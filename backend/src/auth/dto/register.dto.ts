import {
  Equals,
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email!: string;

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères.' })
  @MaxLength(72, { message: 'Le mot de passe ne peut pas dépasser 72 caractères.' })
  password!: string;

  @IsString()
  @MinLength(2, { message: 'Le prénom est requis (2 caractères minimum).' })
  @MaxLength(50)
  firstName!: string;

  @IsString()
  @MinLength(2, { message: 'Le nom est requis (2 caractères minimum).' })
  @MaxLength(50)
  lastName!: string;

  @IsBoolean()
  @Equals(true, { message: "Vous devez accepter les Conditions Générales d'Utilisation." })
  acceptTerms!: boolean;

  @IsBoolean()
  @Equals(true, { message: 'Vous devez accepter la Politique de Confidentialité.' })
  acceptPrivacy!: boolean;

  @IsOptional()
  @IsBoolean()
  marketingEmails?: boolean;
}
