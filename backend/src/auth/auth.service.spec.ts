import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { FakeMail, FakePrisma, FakeRedis, makeConfig } from '../../test/fakes';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: FakePrisma;
  let redis: FakeRedis;
  let mail: FakeMail;

  const EMAIL = 'test@example.com';
  const PASSWORD = 'password123';

  function makeRes(onCookie?: (value: string) => void): Response {
    return {
      cookie: jest.fn((_name: string, value: string) => onCookie?.(value)),
      clearCookie: jest.fn(),
    } as unknown as Response;
  }

  function register() {
    return service.register({
      email: 'Test@Example.com',
      password: PASSWORD,
      firstName: 'Jean',
      lastName: 'Dupont',
      acceptTerms: true,
      acceptPrivacy: true,
    });
  }

  beforeEach(() => {
    prisma = new FakePrisma();
    redis = new FakeRedis();
    mail = new FakeMail();
    service = new AuthService(
      prisma.asService(),
      redis.asService(),
      mail.asService(),
      new JwtService({}),
      makeConfig(),
    );
  });

  it('register crée un utilisateur non vérifié et envoie un OTP à 6 chiffres', async () => {
    const result = await register();
    expect(result.email).toBe(EMAIL);
    expect(mail.lastCode).toMatch(/^\d{6}$/);
    const user = await prisma.user.findUnique({ where: { email: EMAIL } });
    expect(user?.verified).toBe(false);
  });

  it('register refuse un email déjà utilisé', async () => {
    await register();
    await expect(register()).rejects.toBeInstanceOf(ConflictException);
  });

  it('verifyOtp valide le compte et renvoie un accessToken', async () => {
    await register();
    const code = mail.lastCode as string;
    const result = await service.verifyOtp({ email: EMAIL, code }, makeRes());
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.user.verified).toBe(true);
  });

  it('verifyOtp rejette un code invalide', async () => {
    await register();
    await expect(
      service.verifyOtp({ email: EMAIL, code: '000000' }, makeRes()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('login refuse un mot de passe incorrect', async () => {
    await register();
    await service.verifyOtp({ email: EMAIL, code: mail.lastCode as string }, makeRes());
    await expect(
      service.login({ email: EMAIL, password: 'mauvais' }, makeRes()),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('login refuse un compte non vérifié', async () => {
    await register();
    await expect(
      service.login({ email: EMAIL, password: PASSWORD }, makeRes()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('login réussit après vérification', async () => {
    await register();
    await service.verifyOtp({ email: EMAIL, code: mail.lastCode as string }, makeRes());
    const result = await service.login({ email: EMAIL, password: PASSWORD }, makeRes());
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it('refresh effectue une rotation et détecte la réutilisation (révocation de la famille)', async () => {
    await register();
    let current = '';
    await service.verifyOtp(
      { email: EMAIL, code: mail.lastCode as string },
      makeRes((value) => (current = value)),
    );
    const oldToken = current;

    const rotated = await service.refresh(
      oldToken,
      makeRes((value) => (current = value)),
    );
    expect(rotated.accessToken).toEqual(expect.any(String));
    expect(current).not.toBe(oldToken);

    // Réutilisation de l'ancien jeton → session compromise, on révoque tout
    await expect(service.refresh(oldToken, makeRes())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    // Le jeton issu de la rotation est désormais révoqué lui aussi
    await expect(service.refresh(current, makeRes())).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
