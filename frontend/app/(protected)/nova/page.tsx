'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bot, Loader2, Send, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';

interface ChatMessage {
  from: 'prospect' | 'nova';
  text: string;
  intent?: string;
}

const INTENT_LABELS: Record<string, string> = {
  ORDER_INTENT: 'Commande',
  HUMAN_REQUEST: 'Demande humain',
  PRICE_QUERY: 'Question prix',
  INFO_QUERY: 'Question info',
  FOLLOW_UP: 'Relance',
  NONE: '—',
};

export default function NovaTestPage() {
  const { authFetch } = useAuth();
  const { toast } = useToast();
  const [phone, setPhone] = useState('22997000000');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e: FormEvent): Promise<void> {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((prev) => [...prev, { from: 'prospect', text }]);
    setLoading(true);
    try {
      const res = await authFetch<{ reply: string; intent: string }>('/nova/chat', {
        method: 'POST',
        body: JSON.stringify({ prospectPhone: phone, message: text }),
      });
      setMessages((prev) => [...prev, { from: 'nova', text: res.data.reply, intent: res.data.intent }]);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur de génération.', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex h-[100dvh] w-full max-w-2xl flex-col px-4 py-6">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Tableau de bord
      </Link>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tester NOVA</h1>
          <p className="text-sm text-muted-foreground">
            Simulez un prospect : NOVA répond avec votre catalogue (RAG) et votre configuration.
          </p>
        </div>
        <Input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-40"
          aria-label="Numéro du prospect simulé"
        />
      </div>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto rounded-card border border-border bg-[#e5ddd5] p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Écrivez un message comme si vous étiez un prospect sur WhatsApp.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'prospect' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                m.from === 'prospect'
                  ? 'rounded-br-none bg-[#dcf8c6] text-foreground'
                  : 'rounded-bl-none bg-white text-foreground'
              }`}
            >
              <div className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                {m.from === 'prospect' ? (
                  <>
                    <User className="h-3 w-3" /> Prospect
                  </>
                ) : (
                  <>
                    <Bot className="h-3 w-3 text-success" /> NOVA
                    {m.intent ? (
                      <span className="ml-1 rounded-full bg-primary/10 px-1.5 text-[10px] text-primary">
                        {INTENT_LABELS[m.intent] ?? m.intent}
                      </span>
                    ) : null}
                  </>
                )}
              </div>
              <p className="whitespace-pre-line">{m.text}</p>
            </div>
          </div>
        ))}
        {loading ? (
          <div className="flex justify-start">
            <div className="rounded-lg rounded-bl-none bg-white px-3 py-2 text-sm text-muted-foreground shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        ) : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message du prospect…"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
}
