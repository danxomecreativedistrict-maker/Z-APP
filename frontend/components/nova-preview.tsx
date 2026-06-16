import { Bot } from 'lucide-react';

interface NovaPreviewProps {
  novaName: string;
  welcomeMessage?: string;
  tone?: string;
}

const TONE_DEFAULTS: Record<string, string> = {
  formal: 'Bonjour Madame/Monsieur, en quoi puis-je vous assister ?',
  'semi-formal': 'Bonjour ! Comment puis-je vous aider aujourd’hui ? 😊',
  casual: 'Salut ! Dis-moi ce qu’il te faut 👋',
};

/** Bulle WhatsApp simulée — aperçu temps réel de l'accueil de NOVA. */
export function NovaPreview({ novaName, welcomeMessage, tone = 'semi-formal' }: NovaPreviewProps) {
  const message = welcomeMessage?.trim() || TONE_DEFAULTS[tone] || TONE_DEFAULTS['semi-formal'];

  return (
    <div className="rounded-card border border-border bg-[#e5ddd5] p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-medium text-foreground/70">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-success text-white">
          <Bot className="h-4 w-4" />
        </span>
        {novaName || 'NOVA'}
      </div>
      <div className="max-w-[85%] rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm text-foreground shadow-sm">
        {message}
        <div className="mt-1 text-right text-[10px] text-muted-foreground">09:41</div>
      </div>
    </div>
  );
}
