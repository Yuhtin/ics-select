'use client';

import { Card, CardBody, CardHeader } from '@heroui/react';
import { useAuth } from '../../../lib/auth/auth-context';

export default function MeHomePage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Olá, {user?.name}</h1>
        </CardHeader>
        <CardBody className="text-foreground/70">
          Seu plano de estudos semanal aparecerá aqui a partir da Fase 4.
        </CardBody>
      </Card>
    </div>
  );
}
