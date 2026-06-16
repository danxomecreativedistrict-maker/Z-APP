import { FakeRedis } from '../../test/fakes';
import { deriveKey, useRedisAuthState } from './redis-auth-state';

describe('useRedisAuthState', () => {
  const key = deriveKey('secret-test');
  let redis: FakeRedis;

  beforeEach(() => {
    redis = new FakeRedis();
  });

  const svc = () => redis.asService();

  it('chiffre les creds (aucun plaintext lisible)', async () => {
    const auth = await useRedisAuthState(svc(), 'c1', key);
    expect(auth.state.creds).toBeDefined();
    await auth.saveCreds();
    const raw = await redis.get('wa:c1:creds');
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('registrationId');
  });

  it('roundtrip : relit les mêmes creds après rechargement', async () => {
    const first = await useRedisAuthState(svc(), 'c1', key);
    await first.saveCreds();
    const second = await useRedisAuthState(svc(), 'c1', key);
    expect(second.state.creds.registrationId).toBe(first.state.creds.registrationId);
  });

  it('isole les sessions par entreprise', async () => {
    const a1 = await useRedisAuthState(svc(), 'c1', key);
    await a1.saveCreds();
    expect(await redis.keys('wa:c1:*')).toHaveLength(1);
    expect(await redis.keys('wa:c2:*')).toHaveLength(0);
  });

  it('clear supprime toute la session', async () => {
    const auth = await useRedisAuthState(svc(), 'c1', key);
    await auth.saveCreds();
    await auth.clear();
    expect(await redis.keys('wa:c1:*')).toHaveLength(0);
  });
});
