import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { PublicUser } from '../auth.types';

/** Injecte l'utilisateur authentifié (renseigné par JwtStrategy) dans le handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): PublicUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: PublicUser }>();
    return request.user;
  },
);
