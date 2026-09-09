'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import Image from 'next/image';
import { BrandLockup } from '../../components/shell/brand-lockup';
import { Card } from '../../components/ui/card';
import { Info, ShieldCheck, AlertCircle, Lock } from 'lucide-react';

export default function LoginPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  const loginUrl = `${apiBase}/auth/google`;

  return (
    <main className="min-h-[100dvh] bg-bg text-fg">
      <div className="mx-auto grid min-h-[100dvh] max-w-[1400px] grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-12 lg:py-12">
        <div className="mx-auto w-full max-w-[440px]">
          <BrandLockup size="lg" className="mb-10" />

          <Suspense fallback={null}>
            <LoginErrorBanner />
          </Suspense>

          <div className="mb-8">
            <h1 className="font-sans text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              Bem-vindo de volta
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-fg-soft">
              Entre com sua conta institucional para acessar sua semana.
            </p>
          </div>

          <a
            href={loginUrl}
            className="flex min-h-12 w-full items-center justify-center gap-3 whitespace-nowrap rounded-pill bg-primary px-6 py-3 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white">
              <GoogleIcon />
            </span>
            <span>Entrar com Google</span>
          </a>

          <Card className="mt-8 flex items-start gap-3 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.8} />
            <div className="min-w-0">
              <p className="text-sm font-semibold">Uso institucional</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-soft">
                Use seu e-mail{' '}
                <span className="font-mono text-fg">@sou.inteli.edu.br</span>{' '}
                para entrar.
              </p>
            </div>
          </Card>

          <div className="mt-6 flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-fg-mute" strokeWidth={1.8} />
            <p className="text-xs leading-relaxed text-fg-mute">
              Só você enxerga seu Calendar. A gente lê apenas os slots
              marcados como <span className="text-fg-soft">ocupados</span> pra
              agendar estudos nos horários livres — nunca vemos o título,
              descrição ou convidados dos seus eventos.
            </p>
          </div>

          <p className="mt-8 text-xs leading-relaxed text-fg-mute">
            <Info className="mr-1.5 inline h-3.5 w-3.5" strokeWidth={1.8} />
            Sem conta? Esta plataforma é privada ao Academy Fellow.
          </p>
        </div>

        <div className="relative aspect-[4/3] overflow-hidden rounded-card lg:aspect-auto lg:h-[min(720px,calc(100dvh-6rem))] lg:min-h-[520px]">
          <Image
            src="/brand/academy/academy-community.webp"
            alt="Comunidade Inteli Academy reunida no campus do Inteli"
            fill
            priority
            sizes="(min-width: 1400px) 600px, (min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
      </div>
    </main>
  );
}

function LoginErrorBanner() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  if (error !== 'not_invited' && error !== 'auth_retry' && error !== 'account_disabled')
    return null;
  const copy =
    error === 'account_disabled'
      ? {
          title: 'Acesso encerrado',
          body:
            'Sua participação no Academy Fellow foi encerrada. Se acha que é engano, fale com o diretor educacional.',
        }
      : error === 'auth_retry'
      ? {
          title: 'Login falhou — tenta de novo',
          body:
            'O Google rejeitou esse login (geralmente porque a página foi recarregada ou o link foi clicado duas vezes). Clica em "Continuar com Google" abaixo pra fazer um novo login.',
        }
      : {
          title: 'Email não autorizado',
          body:
            'Sua conta ainda não foi convidada para o Academy Fellow. Peça ao diretor educacional para adicionar seu email.',
        };
  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-card border px-4 py-4"
      style={{
        borderColor: 'hsl(var(--danger) / 0.35)',
        background: 'hsl(var(--danger) / 0.08)',
      }}
    >
      <AlertCircle className="mt-[1px] h-4 w-4 shrink-0 text-danger" strokeWidth={1.8} />
      <div className="min-w-0">
        <p className="font-sans text-[13px] font-semibold text-fg">{copy.title}</p>
        <p className="mt-0.5 font-sans text-[12px] leading-relaxed text-fg-soft">{copy.body}</p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
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
