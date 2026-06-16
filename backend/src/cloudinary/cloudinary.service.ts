import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME');
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY');
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET');

    this.configured = Boolean(
      cloudName &&
      apiKey &&
      apiSecret &&
      !cloudName.includes('...') &&
      !apiKey.includes('...') &&
      !apiSecret.includes('...'),
    );

    if (this.configured) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
    } else {
      this.logger.warn(
        'Cloudinary non configuré (clés placeholder) → mode dev : URL de logo factice retournée.',
      );
    }
  }

  /**
   * Téléverse le logo d'une PME. Réutilise un public_id déterministe par entreprise,
   * ce qui remplace automatiquement l'ancien logo. Redimensionne en 200x200 webp q80.
   */
  async uploadLogo(companyId: string, file: Express.Multer.File): Promise<string> {
    if (!this.configured) {
      return `https://placehold.co/200x200/1B4FD8/FFFFFF/webp?text=${encodeURIComponent('Logo')}`;
    }

    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const result: UploadApiResponse = await cloudinary.uploader.upload(dataUri, {
      public_id: `z-app/${companyId}/logos/logo`,
      overwrite: true,
      invalidate: true,
      resource_type: 'image',
      format: 'webp',
      transformation: [{ width: 200, height: 200, crop: 'fill', quality: 80 }],
    });
    this.logger.log(`Logo téléversé pour l'entreprise ${companyId}`);
    return result.secure_url;
  }
}
