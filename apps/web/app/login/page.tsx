'use client';

import { Building2, Clock, Info } from 'lucide-react';
import { BrandLockup } from '../../components/shell/brand-lockup';

export default function LoginPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const loginUrl = `${apiBase}/auth/google`;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 bg-surface rounded-xl overflow-hidden shadow-2xl border border-border/30">
        {/* Left: Login Form */}
        <div className="flex flex-col justify-center p-8 sm:p-12 lg:p-20 relative">
          <div className="absolute top-8 left-8 sm:top-12 sm:left-12">
            <BrandLockup size="md" />
          </div>

          <div className="mt-16 sm:mt-12">
            <h1 className="text-3xl font-extrabold text-foreground mb-2 tracking-tight">
              Bem-vindo ao ICS Select
            </h1>
            <p className="text-foreground-muted mb-10 text-lg">
              Acesse a plataforma de alta performance do Inteli.
            </p>

            <div className="space-y-6">
              <a
                href={loginUrl}
                role="button"
                className="w-full flex items-center justify-center gap-3 bg-surface border border-border hover:bg-surface-muted transition-all duration-200 py-3.5 px-6 rounded-lg text-foreground font-semibold shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <GoogleIcon />
                <span>Entrar com Google</span>
              </a>

              <div className="flex items-center gap-3 px-2">
                <div className="h-px bg-border/50 flex-grow" />
                <span className="text-xs font-bold text-foreground-subtle uppercase tracking-widest">
                  Restrição de Acesso
                </span>
                <div className="h-px bg-border/50 flex-grow" />
              </div>

              <div className="bg-brand-soft/30 p-4 rounded-lg flex items-start gap-3 border border-brand-soft">
                <Info className="h-5 w-5 text-brand flex-shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-sm font-semibold text-brand-soft-foreground leading-tight">
                    Uso exclusivo institucional
                  </p>
                  <p className="text-xs text-brand-soft-foreground/80 mt-1">
                    Utilize obrigatoriamente seu e-mail institucional{' '}
                    <span className="font-bold underline">@inteli.edu.br</span> para realizar o
                    login.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-12 pt-8 border-t border-border/30">
              <p className="text-xs text-foreground-muted leading-relaxed">
                Ao entrar, você concorda com nossos{' '}
                <a href="#" className="text-brand hover:underline font-medium">
                  Termos de Serviço
                </a>{' '}
                e{' '}
                <a href="#" className="text-brand hover:underline font-medium">
                  Política de Privacidade
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Right: Hero Visual (hidden on mobile) */}
        <div
          className="hidden md:flex flex-col justify-between p-12 relative overflow-hidden"
          style={{
            backgroundColor: '#f9f9ff',
            backgroundImage: 'radial-gradient(hsl(var(--brand-soft)) 0.5px, transparent 0.5px)',
            backgroundSize: '24px 24px',
          }}
        >
          {/* Decorative blurs */}
          <div
            className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute bottom-0 left-0 w-80 h-80 bg-brand-soft/30 rounded-full -ml-32 -mb-32 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Top: badge + hero text */}
          <div className="relative z-10">            
            <h2 className="text-4xl lg:text-5xl font-extrabold text-foreground leading-[1.1] tracking-tight">
              Fomentando a próxima geração de{' '}
              <span className="text-brand">líderes técnicos</span>.
            </h2>
          </div>

          {/* Bento cards */}
          <div className="relative z-10 mt-8 grid grid-cols-2 gap-4">
            {/* Member preview */}
            <div className="col-span-2 bg-surface/70 backdrop-blur-md p-6 rounded-xl border border-surface shadow-lg">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand-soft text-brand flex items-center justify-center text-lg font-bold flex-shrink-0">
                  M
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">Membro</p>
                  <p className="text-xs text-foreground-muted">Ciclo 2026.1</p>
                </div>
                <div className="ml-auto bg-success-soft text-success text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter">
                  Ativo
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-1.5 w-full bg-surface-subtle rounded-full overflow-hidden">
                  <div className="h-full bg-brand w-[1%] rounded-full" />
                </div>
                <div className="flex justify-between text-[10px] font-bold text-foreground-muted uppercase">
                  <span>Progresso do Ciclo</span>
                  <span>1%</span>
                </div>
              </div>
            </div>

            {/* Stat mini-cards */}
            <div className="bg-surface/70 backdrop-blur-md p-5 rounded-xl border border-surface shadow-lg flex flex-col items-center justify-center text-center">
              <Building2 className="h-7 w-7 text-brand mb-2" aria-hidden="true" />
              <span className="text-xl font-extrabold text-foreground">12</span>
              <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
                Membros
              </span>
            </div>
            <div className="bg-surface/70 backdrop-blur-md p-5 rounded-xl border border-surface shadow-lg flex flex-col items-center justify-center text-center">
              <Clock className="h-7 w-7 text-warning mb-2" aria-hidden="true" />
              <span className="text-xl font-extrabold text-foreground">1</span>
              <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-widest">
                Ciclo(s)
              </span>
            </div>
          </div>

          {/* Powered by */}
          <div className="relative z-10 pt-8 mt-auto">
            <div className="flex items-center gap-4 opacity-60">
              <span className="text-sm font-bold tracking-widest text-foreground-muted uppercase">
                Feito Por
              </span>
              <div className="w-px h-4 bg-border" />
              <span className="text-lg font-black tracking-tighter text-foreground">
                Davi Duarte
              </span>
            </div>
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
