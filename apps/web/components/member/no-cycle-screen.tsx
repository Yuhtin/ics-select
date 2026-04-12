'use client';

import { ShieldX } from 'lucide-react';
import { BrandLockup } from '../shell/brand-lockup';

interface NoCycleScreenProps {
  userName: string;
  onLogout: () => void;
}

export function NoCycleScreen({ userName, onLogout }: NoCycleScreenProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      <BrandLockup size="lg" className="mb-10" />

      <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full shadow-sm">
        <ShieldX className="h-14 w-14 text-foreground-subtle mx-auto mb-4" strokeWidth={1.2} />

        <h1 className="text-xl font-bold text-foreground mb-2">
          Acesso restrito
        </h1>

        <p className="text-sm text-foreground-muted leading-relaxed">
          Ola, {userName}! Voce ainda nao faz parte de nenhum ciclo ativo do ICS Select.
          Aguarde o processo seletivo do proximo ciclo para ter acesso a plataforma.
        </p>

        <p className="text-xs text-foreground-subtle mt-4">
          Se acredita que isso e um erro, entre em contato com o Diretor Educacional.
        </p>

        <button
          type="button"
          onClick={onLogout}
          className="mt-6 w-full bg-surface-subtle text-foreground-muted rounded-xl py-2.5 text-sm font-medium hover:bg-surface-muted transition-colors"
        >
          Sair
        </button>
      </div>
    </div>
  );
}
