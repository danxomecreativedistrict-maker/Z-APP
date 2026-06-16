import { IsEmail } from 'class-validator';

export class ResendOtpDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  email!: string;
}
