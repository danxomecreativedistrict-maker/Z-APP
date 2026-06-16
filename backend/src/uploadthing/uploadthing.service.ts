import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UTApi } from 'uploadthing/server';

@Injectable()
export class UploadthingService {
  private readonly logger = new Logger(UploadthingService.name);
  private readonly token: string | null;
  // Import paresseux (uploadthing est ESM-only) : chargé seulement lors d'un vrai upload.
  private apiPromise: Promise<UTApi> | null = null;

  constructor(private readonly config: ConfigService) {
    const token = this.config.get<string>('UPLOADTHING_TOKEN');
    this.token = token && token.length > 20 && !token.includes('...') ? token : null;
    if (!this.token) {
      this.logger.warn(
        'UPLOADTHING_TOKEN absent/placeholder → mode dev : URL de logo factice retournée.',
      );
    }
  }

  private getApi(): Promise<UTApi> | null {
    if (!this.token) return null;
    if (!this.apiPromise) {
      const token = this.token;
      this.apiPromise = import('uploadthing/server').then(({ UTApi }) => new UTApi({ token }));
    }
    return this.apiPromise;
  }

  async uploadLogo(companyId: string, file: Express.Multer.File): Promise<string> {
    const apiPromise = this.getApi();
    if (!apiPromise) {
      return `https://placehold.co/200x200/1B4FD8/FFFFFF/webp?text=${encodeURIComponent('Logo')}`;
    }
    const api = await apiPromise;
    const { UTFile } = await import('uploadthing/server');
    const ext = file.mimetype.split('/')[1] ?? 'png';
    const utFile = new UTFile(
      [new Uint8Array(file.buffer)],
      `logo-${companyId}-${Date.now()}.${ext}`,
      {
        type: file.mimetype,
      },
    );

    const res = await api.uploadFiles(utFile);
    if (res.error || !res.data) {
      this.logger.error(`Échec upload logo : ${res.error?.message ?? 'inconnu'}`);
      throw new Error("L'envoi du logo a échoué.");
    }
    const data = res.data as { ufsUrl?: string; url?: string };
    this.logger.log(`Logo téléversé (UploadThing) pour l'entreprise ${companyId}`);
    return data.ufsUrl ?? data.url ?? '';
  }
}
