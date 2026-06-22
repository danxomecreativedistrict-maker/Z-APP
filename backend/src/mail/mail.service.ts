import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly transporter: nodemailer.Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const gmailUser = this.config.get<string>('GMAIL_USER');
    const gmailPass = this.config.get<string>('GMAIL_APP_PASSWORD');

    // 1) Gmail SMTP (prioritaire si configuré) : envoie vers n'importe quel destinataire, gratuit.
    const gmailReady = Boolean(gmailUser && gmailPass);
    this.transporter = gmailReady
      ? nodemailer.createTransport({
          service: 'gmail',
          auth: { user: gmailUser, pass: gmailPass },
        })
      : null;

    // 2) Resend (repli) : nécessite un domaine vérifié pour des destinataires arbitraires.
    const isRealResend = Boolean(apiKey && apiKey.startsWith('re_') && apiKey.length > 10);
    this.resend = isRealResend ? new Resend(apiKey) : null;

    // Avec Gmail, l'expéditeur DOIT être l'adresse Gmail authentifiée.
    this.from = gmailReady
      ? `Z-APP NOVA <${gmailUser}>`
      : (this.config.get<string>('FROM_EMAIL') ?? 'nova@z-app.com');

    if (this.transporter) {
      this.logger.log('Emails actifs via Gmail SMTP.');
    } else if (this.resend) {
      this.logger.log('Emails actifs via Resend.');
    } else {
      this.logger.warn(
        'Aucun fournisseur email (Gmail/Resend) → mode dev : les codes sont affichés en console.',
      );
    }
  }

  /** Envoie un email via Gmail (si configuré), sinon Resend. Retourne false si aucun n'est actif. */
  private async deliver(to: string, subject: string, html: string): Promise<boolean> {
    if (this.transporter) {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    }
    if (this.resend) {
      const { error } = await this.resend.emails.send({ from: this.from, to, subject, html });
      if (error) {
        this.logger.error(`Échec Resend vers ${to} : ${error.message}`);
        return false;
      }
      return true;
    }
    return false;
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    try {
      const sent = await this.deliver(
        to,
        'Votre code de vérification Z-APP',
        this.otpTemplate(code),
      );
      if (sent) {
        this.logger.log(`OTP envoyé à ${to}`);
        return;
      }
    } catch (err) {
      this.logger.error(
        `Échec d'envoi de l'OTP à ${to} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    // Filet de sécurité : on n'échoue jamais l'inscription, le code reste récupérable dans les logs.
    this.logger.log(`📧 [DEV OTP] Code de vérification pour ${to} : ${code}`);
  }

  async sendWhatsappDisconnectedEmail(to: string, companyName: string): Promise<void> {
    try {
      const sent = await this.deliver(
        to,
        '⚠️ Votre WhatsApp Z-APP est déconnecté',
        this.disconnectTemplate(companyName),
      );
      if (sent) {
        this.logger.log(`Alerte de déconnexion WhatsApp envoyée à ${to}`);
        return;
      }
    } catch (err) {
      this.logger.error(
        `Échec de l'alerte de déconnexion à ${to} : ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    this.logger.log(`📧 [DEV ALERTE] WhatsApp déconnecté pour ${companyName} → ${to}`);
  }

  /** Alerte gérant par email (repli quand WhatsApp est hors-ligne). Retourne true si envoyé. */
  async sendNotificationEmail(to: string, type: string, content: string): Promise<boolean> {
    try {
      return await this.deliver(
        to,
        `Z-APP — Notification (${type})`,
        this.notificationTemplate(content),
      );
    } catch (err) {
      this.logger.error(
        `Échec de la notification email à ${to} : ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }

  private notificationTemplate(content: string): string {
    return `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px;">
        <h1 style="color: #1B4FD8;">Z-APP · NOVA</h1>
        <p style="font-size:15px;color:#0f172a;">${content}</p>
        <p style="color:#64748b;font-size:12px;">Notification automatique de votre agent NOVA.</p>
      </div>
    `;
  }

  private disconnectTemplate(companyName: string): string {
    return `
      <div style="font-family: Inter, Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px;">
        <h1 style="color: #1B4FD8;">Z-APP</h1>
        <p>La connexion WhatsApp de <strong>${companyName}</strong> a été interrompue.</p>
        <p>NOVA ne peut plus recevoir ni répondre aux messages de vos prospects.</p>
        <p style="color:#FF6B2B;font-weight:600;">Reconnectez votre WhatsApp depuis votre tableau de bord Z-APP.</p>
      </div>
    `;
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
