import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { CatalogSchema, ExtractedProduct } from './catalog.types';

// Modèle imposé par le brief Z-APP (multimodal : gère texte ET images).
const MODEL = 'claude-sonnet-4-6';

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

const SYSTEM_PROMPT = `Tu es un extracteur de catalogue produits pour des TPE/PME (restaurants, commerces).
À partir du document ou de l'image fournis (menu, catalogue, brochure, tableur, photo d'ardoise ou de carte papier),
identifie chaque PRODUIT vendu et restitue UNIQUEMENT un objet JSON valide, sans aucun texte avant ni après, au format EXACT :
{
  "produits": [
    {
      "nom": "string",
      "categorie": "string",
      "description": "string",
      "prix_min": number ou null,
      "prix_max": number ou null,
      "devise": "string (FCFA par défaut)",
      "disponible": true,
      "confiance_extraction": "haute" | "moyenne" | "basse"
    }
  ]
}
RÈGLES :
- Un seul prix → prix_min = ce prix, prix_max = null. Fourchette de prix → prix_min ET prix_max.
- Devise : "FCFA" par défaut si non précisée.
- "confiance_extraction" = "basse" quand le texte/l'image est flou, ambigu ou illisible pour CE produit, afin que l'humain vérifie.
- N'invente JAMAIS un produit ni un prix. En cas de doute sur un prix, mets-le à null et confiance "basse".
- Réponds en français. Produis SEULEMENT le JSON, sans balises Markdown.`;

@Injectable()
export class CatalogExtractionService {
  private readonly logger = new Logger(CatalogExtractionService.name);
  private readonly client: Anthropic | null;

  constructor(config: ConfigService) {
    const key = config.get<string>('ANTHROPIC_API_KEY');
    const configured = Boolean(key && key.startsWith('sk-ant-') && key.length > 20);
    this.client = configured && key ? new Anthropic({ apiKey: key }) : null;
    if (!this.client) {
      this.logger.warn('ANTHROPIC_API_KEY absente → extraction de catalogue indisponible.');
    }
  }

  get isLive(): boolean {
    return this.client !== null;
  }

  /** Extrait une liste de produits depuis du texte OU une image (vision). */
  async extract(input: {
    text?: string;
    image?: { base64: string; mediaType: ImageMediaType };
  }): Promise<ExtractedProduct[]> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        "L'extraction automatique est indisponible (clé Anthropic non configurée).",
      );
    }

    const content: Anthropic.ContentBlockParam[] = input.image
      ? [
          {
            type: 'image',
            source: { type: 'base64', media_type: input.image.mediaType, data: input.image.base64 },
          },
          { type: 'text', text: 'Extrais le catalogue de produits visible sur cette image.' },
        ]
      : [{ type: 'text', text: `Document à analyser :\n\n${(input.text ?? '').slice(0, 60000)}` }];

    const res = await this.client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    const block = res.content.find((b) => b.type === 'text');
    const raw = block && block.type === 'text' ? block.text : '';
    return this.parse(raw);
  }

  private parse(raw: string): ExtractedProduct[] {
    const cleaned = raw
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .trim();
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return [];
    try {
      const parsed = CatalogSchema.safeParse(JSON.parse(cleaned.slice(start, end + 1)));
      if (parsed.success) return parsed.data.produits;
      this.logger.warn('Extraction : JSON valide mais schéma non conforme.');
    } catch {
      this.logger.warn('Extraction : réponse Claude non parsable en JSON.');
    }
    return [];
  }
}
