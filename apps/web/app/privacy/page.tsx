'use client';

import { Button } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/auth-context';

export default function PrivacyPage() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    setLoading(true);
    try {
      await apiFetch('/me/privacy/accept', { method: 'POST' });
      await refetch();
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 bg-bg px-6">
      <div className="space-y-6 rounded-card border border-border-token bg-surface p-8">
        <h1 className="font-serif text-2xl font-medium text-fg">Aviso de privacidade</h1>
        <div className="space-y-4 font-sans text-sm leading-relaxed text-fg-soft">
          <p>
            Para participar do ICS Select, a plataforma coleta seu nome, email Inteli e
            foto de perfil (via Google). A partir da Fase 3, também lerá sua agenda Google
            (eventos do Calendar) para agendar sessões de estudo, e guardará suas
            reflexões e feedback sobre os itens do plano semanal.
          </p>
          <p>
            O admin do programa (o diretor educacional) pode ver todas as reflexões e o
            progresso dos membros para calibrar os próximos planos. Nada é compartilhado
            com terceiros.
          </p>
          <p>
            Você pode exportar ou excluir todos os seus dados a qualquer momento via{' '}
            <code className="rounded bg-bg-subtle px-1 py-0.5 font-mono text-xs text-fg">
              GET /me/export
            </code>{' '}
            e{' '}
            <code className="rounded bg-bg-subtle px-1 py-0.5 font-mono text-xs text-fg">
              DELETE /me
            </code>
            .
          </p>
        </div>
        <Button color="primary" isLoading={loading} onPress={accept}>
          Aceito e quero continuar
        </Button>
      </div>
    </main>
  );
}
