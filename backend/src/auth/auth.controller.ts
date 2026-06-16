import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { Responded } from '../common/interceptors/response.interceptor';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { PublicUser } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto) {
    const data = await this.auth.register(dto);
    return new Responded(data, 'Compte créé. Un code de vérification a été envoyé par email.');
  }

  @Post('verify-otp')
  @HttpCode(200)
  async verifyOtp(@Body() dto: VerifyOtpDto, @Res({ passthrough: true }) res: Response) {
    const data = await this.auth.verifyOtp(dto, res);
    return new Responded(data, 'Email vérifié. Bienvenue sur Z-APP !');
  }

  @Post('resend-otp')
  @HttpCode(200)
  async resendOtp(@Body() dto: ResendOtpDto) {
    const data = await this.auth.resendOtp(dto);
    return new Responded(data, 'Si un compte non vérifié existe, un nouveau code a été envoyé.');
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const data = await this.auth.login(dto, res);
    return new Responded(data, 'Connexion réussie.');
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    const data = await this.auth.refresh(token, res);
    return new Responded(data, 'Session renouvelée.');
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.['refresh_token'] as string | undefined;
    const data = await this.auth.logout(token, res);
    return new Responded(data, 'Déconnexion réussie.');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: PublicUser) {
    return new Responded(user, 'Profil récupéré.');
  }

  @Post('accept-terms')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async acceptTerms(@CurrentUser() user: PublicUser) {
    return new Responded(await this.auth.acceptTerms(user.id), 'Conditions acceptées.');
  }
}
