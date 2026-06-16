import { IsEmail, IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: 'Le code doit comporter exactement 6 chiffres.' })
  code!: string;
}
