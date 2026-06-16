import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Format de réponse standard de l'API Z-APP. */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message: string;
}

/**
 * Enveloppe optionnelle qu'un contrôleur peut retourner pour fournir
 * un message personnalisé. Ex : `return new Responded(user, 'Compte créé');`
 */
export class Responded<T> {
  constructor(
    public readonly data: T,
    public readonly message: string = 'OK',
  ) {}
}

/**
 * Intercepteur global qui normalise TOUTES les réponses au format
 * { success, data, message } exigé par les règles de développement.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload): ApiResponse<T> => {
        if (payload instanceof Responded) {
          return { success: true, data: payload.data as T, message: payload.message };
        }
        return { success: true, data: payload as T, message: 'OK' };
      }),
    );
  }
}
