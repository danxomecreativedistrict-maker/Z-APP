import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt, randomUUID } from 'crypto';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import {
  CURRENT_TERMS_VERSION,
  PublicUser,
  RefreshTokenPayload,
  SessionResult,
} from './auth.types';

const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;
const REFRESH_COOKIE = 'refresh_token';
const REFRESH_COOKIE_PATH = '/api/auth';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessTtl: string;
  private readonly refreshTtl: string;
  private readonly otpTtl: number;
  private readonly refreshTtlSeconds: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly isProd: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly mail: MailService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.accessTtl = this.config.getOrThrow<string>('JWT_ACCESS_TTL');
    this.refreshTtl = this.config.getOrThrow<string>('JWT_REFRESH_TTL');
    this.otpTtl = Number(this.config.getOrThrow<number>('OTP_TTL_SECONDS'));
    this.refreshTtlSeconds = Number(this.config.getOrThrow<number>('REFRESH_TTL_SECONDS'));
    this.accessSecret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.refreshSecret = this.config.getOrThrow<string>('JWT_REFRESH_SECRET');
    this.isProd = this.config.get<string>('NODE_ENV') === 'production';
  }

  // ───────────────────────── Inscription ─────────────────────────
  async register(dto: RegisterDto): Promise<{ email: string }> {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const now = new Date();
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        termsAcceptedAt: now,
        privacyAcceptedAt: now,
        termsVersion: CURRENT_TERMS_VERSION,
        marketingEmails: dto.marketingEmails ?? false,
      },
    });
    this.logger.log(`Nouvel utilisateur enregistré : ${user.email}`);
    await this.sendOtp(user.email);
    return { email: user.email };
  }

  // ───────────────────────── OTP ─────────────────────────
  private async sendOtp(email: string): Promise<void> {
    const cooldownKey = `otp:cooldown:${email}`;
    if (await this.redis.get(cooldownKey)) {
      throw new BadRequestException('Veuillez patienter avant de demander un nouveau code.');
    }
    const code = this.generateOtp();
    const hash = await bcrypt.hash(code, 10);
    await this.redis.set(`otp:${email}`, hash, this.otpTtl);
    await this.redis.set(`otp:attempts:${email}`, '0', this.otpTtl);
    await this.redis.set(cooldownKey, '1', OTP_COOLDOWN_SECONDS);
    await this.mail.sendOtpEmail(email, code);
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ email: string }> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Réponse volontairement identique que le compte existe ou non (anti-énumération).
    if (user && !user.verified) {
      await this.sendOtp(email);
    }
    return { email };
  }

  async verifyOtp(dto: VerifyOtpDto, res: Response): Promise<SessionResult> {
    const email = dto.email.toLowerCase().trim();
    const otpKey = `otp:${email}`;
    const attemptsKey = `otp:attempts:${email}`;

    const stored = await this.redis.get(otpKey);
    if (!stored) {
      throw new BadRequestException('Code expiré ou introuvable. Demandez un nouveau code.');
    }

    const attempts = await this.redis.incrWithTtl(attemptsKey, this.otpTtl);
    if (attempts > OTP_MAX_ATTEMPTS) {
      await this.redis.del(otpKey, attemptsKey);
      throw new BadRequestException('Trop de tentatives. Demandez un nouveau code.');
    }

    const valid = await bcrypt.compare(dto.code, stored);
    if (!valid) {
      throw new BadRequestException('Code invalide.');
    }

    await this.redis.del(otpKey, attemptsKey, `otp:cooldown:${email}`);
    const user = await this.prisma.user.update({ where: { email }, data: { verified: true } });
    return this.issueSession(user, res);
  }

  // ───────────────────────── Connexion ─────────────────────────
  async login(dto: LoginDto, res: Response): Promise<SessionResult> {
    const email = dto.email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }
    if (!user.verified) {
      await this.sendOtp(email).catch(() => undefined);
      throw new ForbiddenException(
        'Compte non vérifié. Un nouveau code vous a été envoyé par email.',
      );
    }
    return this.issueSession(user, res);
  }

  // ───────────────────────── Refresh (rotation) ─────────────────────────
  async refresh(refreshToken: string | undefined, res: Response): Promise<SessionResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Session expirée. Veuillez vous reconnecter.');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Session invalide. Veuillez vous reconnecter.');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Jeton invalide.');
    }

    const redisKey = `refresh:${payload.sub}:${payload.jti}`;
    const exists = await this.redis.get(redisKey);
    if (!exists) {
      // Le jeton n'est plus dans l'allowlist → réutilisation : on révoque toute la famille.
      await this.revokeAll(payload.sub);
      this.clearRefreshCookie(res);
      throw new UnauthorizedException('Session compromise détectée. Veuillez vous reconnecter.');
    }

    await this.redis.del(redisKey); // rotation : l'ancien jeton est invalidé
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }
    return this.issueSession(user, res);
  }

  // ───────────────────────── Déconnexion ─────────────────────────
  async logout(refreshToken: string | undefined, res: Response): Promise<{ loggedOut: boolean }> {
    if (refreshToken) {
      try {
        const payload = await this.jwt.verifyAsync<RefreshTokenPayload>(refreshToken, {
          secret: this.refreshSecret,
        });
        await this.redis.del(`refresh:${payload.sub}:${payload.jti}`);
      } catch {
        // jeton déjà invalide : rien à faire
      }
    }
    this.clearRefreshCookie(res);
    return { loggedOut: true };
  }

  // ───────────────────────── Helpers ─────────────────────────
  private async issueSession(user: User, res: Response): Promise<SessionResult> {
    const accessToken = await this.signAccess(user);
    const refreshToken = await this.signRefresh(user.id);
    this.setRefreshCookie(res, refreshToken);
    return { accessToken, user: this.toPublicUser(user) };
  }

  private signAccess(user: User): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, email: user.email, type: 'access' },
      { secret: this.accessSecret, expiresIn: this.accessTtl },
    );
  }

  private async signRefresh(userId: string): Promise<string> {
    const jti = randomUUID();
    const token = await this.jwt.signAsync(
      { sub: userId, jti, type: 'refresh' },
      { secret: this.refreshSecret, expiresIn: this.refreshTtl },
    );
    await this.redis.set(`refresh:${userId}:${jti}`, '1', this.refreshTtlSeconds);
    return token;
  }

  private async revokeAll(userId: string): Promise<void> {
    const keys = await this.redis.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }

  private setRefreshCookie(res: Response, token: string): void {
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: this.isProd,
      sameSite: 'lax',
      path: REFRESH_COOKIE_PATH,
      maxAge: this.refreshTtlSeconds * 1000,
    });
  }

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(REFRESH_COOKIE, { path: REFRESH_COOKIE_PATH });
  }

  private generateOtp(): string {
    return String(randomInt(0, 1_000_000)).padStart(6, '0');
  }

  /** Met à jour l'acceptation des CGU à la version courante (modale de re-acceptation). */
  async acceptTerms(userId: string): Promise<PublicUser> {
    const now = new Date();
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { termsAcceptedAt: now, privacyAcceptedAt: now, termsVersion: CURRENT_TERMS_VERSION },
    });
    return this.toPublicUser(user);
  }

  private toPublicUser(user: User): PublicUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      verified: user.verified,
      plan: user.plan,
      termsUpToDate: user.termsVersion === CURRENT_TERMS_VERSION,
    };
  }
}
