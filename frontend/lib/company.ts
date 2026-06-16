export interface Company {
  id: string;
  name: string;
  sector: string | null;
  city: string | null;
  country: string;
  ownerPhone: string;
  managerPhone: string;
  logoUrl: string | null;
  novaName: string;
  novaTone: string;
  novaLanguage: string;
  welcomeMessage: string | null;
  deliveryPolicy: string | null;
  paymentPolicy: string | null;
  deliveryZones: string[];
  deliveryDelay: string | null;
  alertPhone: string | null;
  delivererPhone: string | null;
  dailySummaryTime: string;
  dailySummaryOn: boolean;
  onboardingDone: boolean;
}

export const SECTORS = [
  'Commerce',
  'Restauration',
  'Services',
  'Santé',
  'Education',
  'Immobilier',
  'Transport',
  'Agriculture',
  'Autre',
] as const;

export const NOVA_TONES = [
  {
    value: 'formal',
    label: 'Formel',
    example: 'Bonjour Madame/Monsieur, en quoi puis-je vous assister ?',
  },
  {
    value: 'semi-formal',
    label: 'Semi-formel',
    example: 'Bonjour ! Comment puis-je vous aider aujourd’hui ? 😊',
  },
  {
    value: 'casual',
    label: 'Décontracté',
    example: 'Salut ! Dis-moi ce qu’il te faut 👋',
  },
] as const;
