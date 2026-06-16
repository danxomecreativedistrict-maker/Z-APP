import Link from 'next/link';
import { Bot, MessageCircle, ShoppingCart, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const features = [
  {
    icon: MessageCircle,
    title: 'WhatsApp natif',
    description: 'NOVA discute avec vos prospects directement sur WhatsApp, 24h/24.',
  },
  {
    icon: Sparkles,
    title: 'IA + RAG',
    description: 'Réponses fondées sur votre catalogue et vos documents, jamais inventées.',
  },
  {
    icon: ShoppingCart,
    title: 'Prise de commande',
    description: 'NOVA qualifie, conseille et conclut la vente, puis notifie votre équipe.',
  },
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center gap-12 px-4 py-16">
      <header className="flex flex-col items-center gap-5 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
          <Bot className="h-4 w-4" />
          Module 1 — Infrastructure opérationnelle
        </span>
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Z-APP, votre agent commercial <span className="text-primary">NOVA</span>
        </h1>
        <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
          La plateforme SaaS qui dote chaque entreprise d&apos;un agent commercial virtuel
          intelligent, propulsé par Claude et connecté à WhatsApp.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <Link href="/register">Commencer</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Se connecter</Link>
          </Button>
        </div>
      </header>

      <section className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        {features.map((feature) => (
          <Card key={feature.title}>
            <CardHeader>
              <feature.icon className="h-8 w-8 text-accent" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <span className="h-2 w-2 rounded-full bg-success" />
                Bientôt disponible
              </span>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
