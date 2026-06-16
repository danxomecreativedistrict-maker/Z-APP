import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.from = this.config.get<string>('FROM_EMAIL') ?? 'nova@z-app.com';

    // N'active Resend que si une vraie clé est fournie (sinon repli dev : log console).
    const isRealKey = Boolean(apiKey && apiKey.startsWith('re_') && apiKey.length > 10);
    this.resend = isRealKey ? new Resend(apiKey) : null;

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY absente ou placeholder → mode dev : les codes OTP sont affichés en console.',
      );
    }
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    if (!this.resend) {
      this.logger.log(`📧 [DEV OTP] Code de vérification pour ${to} : ${code}`);
      return;
    }

    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Votre code de vérification Z-APP',
      html: this.otpTemplate(code),
    });

    if (error) {
      this.logger.error(`Échec de l'envoi de l'OTP à ${to} : ${error.message}`);
      throw new Error("L'envoi de l'email de vérification a échoué.");
    }
    this.logger.log(`OTP envoyé à ${to}`);
  }

  private otpTemplate(code: string): string {
    return `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #F8FAFF; border-radius: 12px;">
        <h1 style="color: #1B4FD8; font-size: 22px;">Z-APP</h1>
        <p style="color: #0f172a; font-size: 15px;">Voici votre code de vérification :</p>
        <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #1B4FD8; text-align: center; padding: 16px; background: #fff; border-radius: 12px; margin: 16px 0;">
          ${code}
        </div>
        <p style="color: #64748b; font-size: 13px;">Ce code expire dans 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>
    `;
  }
}
