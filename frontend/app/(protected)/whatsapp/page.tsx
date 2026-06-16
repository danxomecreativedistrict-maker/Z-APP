'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { ArrowLeft, CheckCircle2, Loader2, LogOut, RefreshCw, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/lib/toast';

type WAStatus = 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING';
interface StatusPayload {
  status: WAStatus;
  qr?: string | null;
  phone?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const WS_BASE = API_URL.replace(/\/api\/?$/, '');

export default function WhatsappPage() {
  const { authFetch, getToken } = useAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<WAStatus>('DISCONNECTED');
  const [qr, setQr] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(`${WS_BASE}/whatsapp`, {
      auth: { token: getToken() },
      transports: ['websocket'],
    });
    socketRef.current = socket;
    socket.on('whatsapp:status', (payload: StatusPayload) => {
      setStatus(payload.status);
      if (payload.qr !== undefined) setQr(payload.qr ?? null);
      if (payload.phone !== undefined) setPhone(payload.phone ?? null);
      if (payload.status === 'CONNECTED') {
        setQr(null);
        toast('WhatsApp connecté ✅');
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [getToken, toast]);

  useEffect(() => {
    authFetch<StatusPayload>('/whatsapp/status')
      .then((r) => {
        setStatus(r.data.status);
        setPhone(r.data.phone ?? null);
      })
      .catch(() => undefined);
  }, [authFetch]);

  const connect = useCallback(async () => {
    setLoading(true);
    setStatus('CONNECTING');
    try {
      const res = await authFetch<StatusPayload>('/whatsapp/qr');
      setStatus(res.data.status);
      setQr(res.data.qr ?? null);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur de connexion.', 'error');
      setStatus('DISCONNECTED');
    } finally {
      setLoading(false);
    }
  }, [authFetch, toast]);

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await authFetch('/whatsapp/logout', { method: 'POST' });
      setStatus('DISCONNECTED');
      setQr(null);
      setPhone(null);
      toast('WhatsApp déconnecté.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Erreur.', 'error');
    } finally {
      setLoading(false);
    }
  }, [authFetch, toast]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Tableau de bord
      </Link>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">Connexion WhatsApp</h1>
      <p className="text-sm text-muted-foreground">
        Connectez le numéro WhatsApp par lequel NOVA discutera avec vos prospects.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Statut</CardTitle>
            <StatusBadge status={status} />
          </div>
          <CardDescription>
            {status === 'CONNECTED'
              ? `Numéro connecté : ${phone ?? '—'}`
              : status === 'CONNECTING'
                ? 'Scannez le QR code avec WhatsApp (Appareils connectés).'
                : 'Aucun WhatsApp connecté.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'CONNECTING' && qr ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qr}
                alt="QR code WhatsApp"
                className="h-64 w-64 rounded-card border border-border bg-white p-2"
              />
            </div>
          ) : null}

          {status === 'CONNECTING' && !qr ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              Génération du QR code…
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {status === 'CONNECTED' ? (
              <Button variant="destructive" onClick={disconnect} disabled={loading}>
                <LogOut className="h-4 w-4" /> Déconnecter
              </Button>
            ) : (
              <Button onClick={connect} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {status === 'CONNECTING' ? 'Régénérer le QR' : 'Connecter WhatsApp'}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Sur votre téléphone : WhatsApp → Paramètres → Appareils connectés → Connecter un appareil,
            puis scannez le code ci-dessus.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function StatusBadge({ status }: { status: WAStatus }) {
  if (status === 'CONNECTED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-medium text-success">
        <CheckCircle2 className="h-4 w-4" /> Connecté
      </span>
    );
  }
  if (status === 'CONNECTING') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
        <Loader2 className="h-4 w-4 animate-spin" /> En attente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-sm font-medium text-destructive">
      <XCircle className="h-4 w-4" /> Déconnecté
    </span>
  );
}
