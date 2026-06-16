import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ApiResponse, Responded, ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor();
  const ctx = {} as ExecutionContext;

  function callWith(value: unknown): Promise<ApiResponse<unknown>> {
    const handler: CallHandler = { handle: () => of(value) };
    return firstValueFrom(interceptor.intercept(ctx, handler));
  }

  it('enveloppe une valeur brute au format { success, data, message }', async () => {
    const res = await callWith({ id: 1 });
    expect(res).toEqual({ success: true, data: { id: 1 }, message: 'OK' });
  });

  it('respecte le message personnalisé via Responded', async () => {
    const res = await callWith(new Responded({ id: 2 }, 'Créé avec succès'));
    expect(res).toEqual({ success: true, data: { id: 2 }, message: 'Créé avec succès' });
  });
});
