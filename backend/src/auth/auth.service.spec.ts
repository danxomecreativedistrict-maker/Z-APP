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
import { SessionResult } from './auth.types';

describe('AuthService', () => {
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

  // Construit un service avec la vérification email activée (V2) ou non (V1, défaut).
  function makeService(emailVerification = false): AuthService {
    prisma = new FakePrisma();
    redis = new FakeRedis();
    mail = new FakeMail();
    return new AuthService(
      prisma.asService(),
      redis.asService(),
      mail.asService(),
      new JwtService({}),
      makeConfig({ EMAIL_VERIFICATION: emailVerification ? 'true' : 'false' }),
    );
  }

  function register(service: AuthService, res: Response = makeRes()) {
    return service.register(
      {
        email: 'Test@Example.com',
        password: PASSWORD,
        firstName: 'Jean',
        lastName: 'Dupont',
        acceptTerms: true,
        acceptPrivacy: true,
      },
      res,
    );
  }

  // ───────────────────────── V1 : connexion immédiate (pas d'OTP) ─────────────────────────
  describe('V1 — inscription sans vérification email', () => {
    let service: AuthService;
    beforeEach(() => {
      service = makeService(false);
    });

    it('register connecte immédiatement (accessToken) et crée un compte vérifié, sans OTP', async () => {
      const result = (await register(service)) as SessionResult;
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user.verified).toBe(true);
      expect(mail.lastCode).toBeNull(); // aucun email envoyé
      const user = await prisma.user.findUnique({ where: { email: EMAIL } });
      expect(user?.verified).toBe(true);
    });

    it('register refuse un email déjà utilisé', async () => {
      await register(service);
      await expect(register(service)).rejects.toBeInstanceOf(ConflictException);
    });

    it('login réussit directement après inscription (aucune vérification requise)', async () => {
      await register(service);
      const result = await service.login({ email: EMAIL, password: PASSWORD }, makeRes());
      expect(result.accessToken).toEqual(expect.any(String));
    });

    it('login refuse un mot de passe incorrect', async () => {
      await register(service);
      await expect(
        service.login({ email: EMAIL, password: 'mauvais' }, makeRes()),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('refresh effectue une rotation et détecte la réutilisation (révocation de la famille)', async () => {
      let current = '';
      await register(
        service,
        makeRes((value) => (current = value)),
      );
      const oldToken = current;

      const rotated = await service.refresh(
        oldToken,
        makeRes((value) => (current = value)),
      );
      expect(rotated.accessToken).toEqual(expect.any(String));
      expect(current).not.toBe(oldToken);

      // Réutilisation de l'ancien jeton → session compromise, on révoque tout.
      await expect(service.refresh(oldToken, makeRes())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(service.refresh(current, makeRes())).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  // ───────────────────────── V2 : flux OTP réactivable (EMAIL_VERIFICATION=true) ─────────────────────────
  describe('V2 — vérification email activée', () => {
    let service: AuthService;
    beforeEach(() => {
      service = makeService(true);
    });

    it('register crée un utilisateur non vérifié et envoie un OTP à 6 chiffres', async () => {
      const result = (await register(service)) as { email: string };
      expect(result.email).toBe(EMAIL);
      expect(mail.lastCode).toMatch(/^\d{6}$/);
      const user = await prisma.user.findUnique({ where: { email: EMAIL } });
      expect(user?.verified).toBe(false);
    });

    it('verifyOtp valide le compte et renvoie un accessToken', async () => {
      await register(service);
      const code = mail.lastCode as string;
      const result = await service.verifyOtp({ email: EMAIL, code }, makeRes());
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.user.verified).toBe(true);
    });

    it('verifyOtp rejette un code invalide', async () => {
      await register(service);
      await expect(
        service.verifyOtp({ email: EMAIL, code: '000000' }, makeRes()),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('login refuse un compte non vérifié', async () => {
      await register(service);
      await expect(
        service.login({ email: EMAIL, password: PASSWORD }, makeRes()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
