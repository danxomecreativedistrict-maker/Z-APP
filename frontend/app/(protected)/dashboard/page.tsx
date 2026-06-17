'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import {
  Bell,
  BookOpen,
  Bot,
  Flame,
  LogOut,
  MessageCircle,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';
import {
  ConversationSummary,
  DashboardStats,
  NOTIF_LABELS,
  NotificationRow,
  ORDER_STATUS_LABELS,
  OrderRow,
  ProspectRow,
  SCORE_STYLES,
  cleanPhone,
  formatDateTime,
  formatFcfa,
} from '@/lib/dashboard';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const WS_BASE = API_URL.replace(/\/api\/?$/, '');

export default function DashboardPage() {
  const { user, loading, logout, authFetch, getToken } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [prospects, setProspects] = useState<ProspectRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [live, setLive] = useState(false);
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAll = useCallback(async () => {
    try {
      const [s, c, p, o, n] = await Promise.all([
        authFetch<DashboardStats>('/dashboard/stats'),
        authFetch<ConversationSummary[]>('/dashboard/conversations'),
        authFetch<ProspectRow[]>('/dashboard/prospects'),
        authFetch<OrderRow[]>('/dashboard/orders'),
        authFetch<NotificationRow[]>('/notifications'),
      ]);
      setStats(s.data);
      setConversations(c.data);
      setProspects(p.data);
      setOrders(o.data);
      setNotifications(n.data);
    } catch {
      // silencieux : un toast à chaque tick serait bruyant
    }
  }, [authFetch]);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (user) void loadAll();
  }, [user, loadAll]);

  // Temps réel : un événement métier déclenche un rechargement (anti-rebond 400 ms).
  useEffect(() => {
    if (!user) return;
    const socket: Socket = io(`${WS_BASE}/dashboard`, {
      auth: { token: getToken() },
      transports: ['websocket'],
    });
    const scheduleReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => void loadAll(), 400);
    };
    socket.on('connect', () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    socket.on('dashboard:message', scheduleReload);
    socket.on('dashboard:order', () => {
      toast('🎉 Nouvelle commande !', 'success');
      scheduleReload();
    });
    socket.on('dashboard:notification', scheduleReload);
    socket.on('dashboard:prospect', scheduleReload);
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      socket.disconnect();
    };
  }, [user, getToken, loadAll, toast]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement…
      </main>
    );
  }

  const kpis = [
    {
      label: 'Conversations actives',
      value: stats?.conversations.active ?? 0,
      hint: stats?.conversations.waitingHuman
        ? `${stats.conversations.waitingHuman} en attente d'un humain`
        : 'En cours avec NOVA',
      icon: MessageSquare,
    },
    {
      label: 'Prospects',
      value: stats?.prospects.total ?? 0,
      hint: `${stats?.prospects.hot ?? 0} chauds · ${stats?.prospects.newToday ?? 0} aujourd'hui`,
      icon: Users,
    },
    {
      label: "Commandes aujourd'hui",
      value: stats?.orders.today ?? 0,
      hint: formatFcfa(stats?.orders.revenueToday ?? 0),
      icon: ShoppingBag,
    },
    {
      label: "Chiffre d'affaires",
      value: formatFcfa(stats?.orders.revenueTotal ?? 0),
      hint: `${stats?.orders.total ?? 0} commandes au total`,
      icon: Package,
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bonjour {user.firstName} 👋</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Plan {user.plan} · {user.email}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                live ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-success' : 'bg-muted-foreground'}`}
              />
              {live ? 'Temps réel' : 'Hors ligne'}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" asChild>
            <Link href="/whatsapp">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Link>
          </Button>
          <Button variant="success" asChild>
            <Link href="/nova">
              <Bot className="h-4 w-4" />
              Tester NOVA
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/knowledge">
              <BookOpen className="h-4 w-4" />
              Connaissances
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="h-4 w-4" />
              Paramètres
            </Link>
          </Button>
          <Button variant="outline" onClick={() => logout().then(() => router.replace('/login'))}>
            <LogOut className="h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.label}
              </CardTitle>
              <kpi.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* Pipeline prospects */}
      <section className="mt-4 grid grid-cols-3 gap-4">
        <PipelineCard label="Chauds" value={stats?.prospects.hot ?? 0} score="HOT" />
        <PipelineCard label="Tièdes" value={stats?.prospects.warm ?? 0} score="WARM" />
        <PipelineCard label="Froids" value={stats?.prospects.cold ?? 0} score="COLD" />
      </section>

      <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Conversations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquare className="h-4 w-4 text-primary" /> Conversations récentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {conversations.length === 0 ? (
              <EmptyState text="Aucune conversation pour l'instant." />
            ) : (
              conversations.slice(0, 6).map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      {c.prospectName ?? cleanPhone(c.prospectPhone)}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SCORE_STYLES[c.score]}`}>
                        {c.score}
                      </span>
                      {c.status === 'WAITING_HUMAN' && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
                          À reprendre
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {c.lastMessage
                        ? `${c.lastMessage.sender === 'PROSPECT' ? '👤' : '🤖'} ${c.lastMessage.content}`
                        : '—'}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTime(c.updatedAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Commandes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4 text-primary" /> Commandes récentes
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orders.length === 0 ? (
              <EmptyState text="Aucune commande pour l'instant." />
            ) : (
              orders.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{o.ref}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {o.prospectName ?? cleanPhone(o.prospectPhone ?? '—')}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatFcfa(o.total)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ORDER_STATUS_LABELS[o.status]}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* Notifications */}
      <section className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4 text-primary" /> Notifications
              {stats?.notifications.unread ? (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                  {stats.notifications.unread} non lues
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notifications.length === 0 ? (
              <EmptyState text="Aucune notification." />
            ) : (
              notifications.slice(0, 8).map((n) => (
                <div key={n.id} className="flex items-start gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                  <span
                    className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n.read ? 'bg-muted-foreground/30' : 'bg-accent'}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {NOTIF_LABELS[n.type]}
                    </p>
                    <p className="text-sm">{n.content}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDateTime(n.sentAt)}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function PipelineCard({
  label,
  value,
  score,
}: {
  label: string;
  value: number;
  score: 'HOT' | 'WARM' | 'COLD';
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
        <span className={`rounded-full p-2 ${SCORE_STYLES[score]}`}>
          <Flame className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-4 text-center text-sm text-muted-foreground">{text}</p>;
}
