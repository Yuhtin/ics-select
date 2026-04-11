'use client';

import { Button, Card, CardBody, CardHeader } from '@heroui/react';
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Aviso de privacidade</h1>
        </CardHeader>
        <CardBody className="space-y-4 text-sm leading-relaxed text-foreground/80">
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
            <code>GET /me/export</code> e <code>DELETE /me</code>.
          </p>
          <div className="pt-2">
            <Button color="primary" isLoading={loading} onPress={accept}>
              Aceito e quero continuar
            </Button>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
