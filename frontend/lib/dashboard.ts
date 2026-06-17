// Types et helpers du tableau de bord temps réel (Module 9).

export type ProspectScore = 'HOT' | 'WARM' | 'COLD';
export type ConvStatus = 'ACTIVE' | 'WAITING_HUMAN' | 'CLOSED';
export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'DELIVERING'
  | 'DELIVERED'
  | 'CANCELLED';
export type Sender = 'NOVA' | 'HUMAN' | 'PROSPECT';
export type NotifType = 'SALE' | 'DELIVERY' | 'TRANSFER' | 'DAILY_SUMMARY' | 'MISSED_CALL';

export interface DashboardStats {
  prospects: { total: number; hot: number; warm: number; cold: number; newToday: number };
  conversations: { total: number; active: number; waitingHuman: number };
  orders: { total: number; today: number; revenueToday: number; revenueTotal: number };
  products: { total: number };
  notifications: { unread: number };
}

export interface ConversationSummary {
  id: string;
  prospectPhone: string;
  prospectName: string | null;
  score: ProspectScore;
  status: ConvStatus;
  updatedAt: string;
  messageCount: number;
  lastMessage: { content: string; sender: Sender; sentAt: string } | null;
}

export interface ProspectRow {
  id: string;
  phone: string;
  name: string | null;
  score: ProspectScore;
  status: string;
  lastContact: string | null;
  createdAt: string;
}

export interface OrderRow {
  id: string;
  ref: string;
  total: number;
  status: OrderStatus;
  deliveryAddress: string | null;
  createdAt: string;
  prospectName: string | null;
  prospectPhone: string | null;
}

export interface NotificationRow {
  id: string;
  type: NotifType;
  content: string;
  recipient: string;
  sent: boolean;
  read: boolean;
  sentAt: string;
}

export function formatFcfa(value: number): string {
  return `${new Intl.NumberFormat('fr-FR').format(value)} FCFA`;
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function cleanPhone(jid: string): string {
  return jid.replace(/@s\.whatsapp\.net$/, '');
}

export const SCORE_STYLES: Record<ProspectScore, string> = {
  HOT: 'bg-accent/10 text-accent',
  WARM: 'bg-primary/10 text-primary',
  COLD: 'bg-muted text-muted-foreground',
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'Préparation',
  DELIVERING: 'En livraison',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

export const NOTIF_LABELS: Record<NotifType, string> = {
  SALE: 'Vente',
  DELIVERY: 'Livraison',
  TRANSFER: 'Transfert',
  DAILY_SUMMARY: 'Résumé',
  MISSED_CALL: 'Appel manqué',
};
