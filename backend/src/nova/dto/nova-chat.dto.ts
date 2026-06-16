import { IsString, MaxLength, MinLength } from 'class-validator';

export class NovaChatDto {
  @IsString()
  @MinLength(3, { message: 'Numéro de prospect invalide.' })
  @MaxLength(40)
  prospectPhone!: string;

  @IsString()
  @MinLength(1, { message: 'Le message est requis.' })
  @MaxLength(2000)
  message!: string;
}
