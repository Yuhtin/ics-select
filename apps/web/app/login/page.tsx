'use client';

import { Building2 } from 'lucide-react';
import { BrandLockup } from '../../components/shell/brand-lockup';

export default function LoginPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const loginUrl = `${apiBase}/auth/google`;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6 relative overflow-hidden">
      {/* Dot grid — fades radially from center */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgb(15 23 42 / 0.08) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
          maskImage:
            'radial-gradient(ellipse 70% 60% at center, black 20%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 70% 60% at center, black 20%, transparent 75%)',
        }}
        aria-hidden="true"
      />

      {/* Brand glow — top-left, grounds the identity */}
      <div
        className="absolute top-[-20%] left-[-10%] h-[55%] w-[55%] rounded-full bg-brand/[0.12] blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Brand glow — bottom-right, adds depth */}
      <div
        className="absolute bottom-[-15%] right-[-10%] h-[45%] w-[45%] rounded-full bg-brand/[0.09] blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* Top radial glow — hero beam behind card */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 h-[400px] w-[700px] rounded-full bg-brand/[0.06] blur-[120px] pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 w-full max-w-md flex flex-col items-center">
        {/* Brand mobile: lockup fora do card */}
        <div className="mb-8 sm:hidden">
          <BrandLockup size="xl" />
        </div>

        <div className="w-full rounded-xl border border-border bg-surface p-6 sm:p-8 shadow-md">
          {/* Brand desktop: lockup dentro do card */}
          <div className="hidden sm:flex justify-center mb-6">
            <BrandLockup size="lg" />
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Bem-vindo ao ICS Select
            </h1>
            <p className="text-sm text-foreground-muted leading-relaxed mt-2">
              Acesse a plataforma de preparação técnica para consultoria.
            </p>
          </div>

          <a
            href={loginUrl}
            role="button"
            className="mt-8 w-full inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-surface text-foreground text-sm font-semibold rounded-lg border border-border hover:border-brand/50 hover:bg-brand-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-all active:scale-[0.98]"
          >
            <GoogleIcon />
            Entrar com Google
          </a>

          <div className="flex items-center gap-4 py-6">
            <div className="h-px flex-grow bg-border" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-foreground-subtle">
              Segurança
            </span>
            <div className="h-px flex-grow bg-border" />
          </div>

          <div className="flex items-center gap-3 p-4 rounded-lg bg-brand-soft/40 border border-brand/10">
            <Building2 className="h-4 w-4 text-brand flex-shrink-0" aria-hidden="true" />
            <p className="text-xs text-foreground-muted leading-tight">
              Use seu e-mail institucional{' '}
              <span className="text-brand font-semibold">@inteli.edu.br</span> para autenticação
              automática.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
