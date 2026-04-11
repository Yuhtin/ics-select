'use client';

import { Button } from '@heroui/react';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">ICS Select</h1>
      <p className="max-w-md text-foreground/70">
        Programa de Preparação Avançada para Entrevistas Técnicas. Use seu email Inteli
        para entrar.
      </p>
      <Button
        as="a"
        href={`${apiBase}/auth/google`}
        color="primary"
        startContent={<LogIn className="h-4 w-4" aria-hidden="true" />}
      >
        Entrar com Google
      </Button>
    </main>
  );
}
