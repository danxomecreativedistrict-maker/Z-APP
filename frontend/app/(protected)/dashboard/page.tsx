'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
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

const metrics = [
  { label: 'Conversations actives', value: '—', icon: MessageSquare },
  { label: 'Prospects du jour', value: '—', icon: Users },
  { label: 'Commandes', value: '—', icon: ShoppingBag },
  { label: 'Produits', value: '—', icon: Package },
];

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        Chargement…
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Bonjour {user.firstName} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan {user.plan} · {user.email}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="accent" asChild>
            <Link href="/whatsapp">
              <MessageCircle className="h-4 w-4" />
              WhatsApp
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

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {metric.label}
              </CardTitle>
              <metric.icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metric.value}</div>
            </CardContent>
          </Card>
        ))}
      </section>

      <p className="mt-8 text-sm text-muted-foreground">
        Les métriques temps réel seront activées au Module 9 (Dashboard). Modules à venir :
        configuration entreprise, connexion WhatsApp, base de connaissances, NOVA…
      </p>
    </main>
  );
}
