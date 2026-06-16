import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Protège une route : exige un access token JWT valide dans l'en-tête Authorization. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
