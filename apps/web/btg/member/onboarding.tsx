'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TRACKS, type Track } from '@ics-select/shared';
import { useAuth } from '../../lib/auth/auth-context';
import { ApiErrorResponse } from '../../lib/api/client';
import { useUpdateAvailability, useUpdateProfile } from '../../lib/queries/me-settings';
import { useUpdateTheme } from '../../lib/queries/me-theme';
import { useThemeWithSync } from '../../lib/theme/use-theme-sync';
import { BTG_LOGO_NAVY, HeroMark, Icon } from '../ui';
import { BTG_MEMBER_BASE } from './shell';
import {
  DayCaps,
  PHONE_REGEX,
  PhoneField,
  SessionLength,
  ThemePicker,
  TrackPicker,
  type DayMinutes,
} from './member-extra-fields';

const DEFAULT_CAPS: DayMinutes = {
  mondayMinutes: 60,
  tuesdayMinutes: 60,
  wednesdayMinutes: 60,
  thursdayMinutes: 60,
  fridayMinutes: 30,
  saturdayMinutes: 90,
  sundayMinutes: null,
};

const STEPS = [
  { label: 'WhatsApp', title: 'Onde falamos com você?', sub: 'Os lembretes chegam dez minutos antes de cada bloco de estudo e a retro abre toda sexta. Só WhatsApp, sem spam de e-mail.' },
  { label: 'Trilha', title: 'Qual é o seu alvo?', sub: 'Define o tipo de prática que o Diretor Educacional escolhe para você a cada semana. Dá para trocar entre ciclos.' },
  { label: 'Disponibilidade', title: 'Quanto tempo por dia?', sub: 'Minutos que você consegue proteger para estudar. O agendador encaixa os blocos nesse orçamento, e você ajusta quando quiser.' },
  { label: 'Aparência', title: 'Claro ou escuro?', sub: 'A tela muda enquanto você escolhe. Dá para trocar depois em Configurações.' },
];

export function BtgOnboarding() {
  const router = useRouter();
  const { user, refetch } = useAuth();
  const updateProfile = useUpdateProfile();
  const updateAvailability = useUpdateAvailability();
  const updateTheme = useUpdateTheme();
  const { resolvedTheme, setTheme, mounted } = useThemeWithSync();

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [track, setTrack] = useState('');
  const [caps, setCaps] = useState<DayMinutes>(DEFAULT_CAPS);
  const [sessionMin, setSessionMin] = useState(30);
  const [error, setError] = useState<string | null>(null);

  const phoneOk = PHONE_REGEX.test(phone);
  const trackOk = (TRACKS as readonly string[]).includes(track);
  const capsOk = Object.values(caps).reduce<number>((s, v) => s + (v ?? 0), 0) > 0;
  const canAdvance = [phoneOk, trackOk, capsOk, true][step];
  const submitting = updateProfile.isPending || updateAvailability.isPending || updateTheme.isPending;

  async function finish() {
    if (submitting) return;
    setError(null);
    try {
      // Profile first: it creates the cycle membership, so the gate sees targetTrack.
      await updateProfile.mutateAsync({ whatsappPhone: phone, targetTrack: track as Track });
      await updateAvailability.mutateAsync({
        mondayMinutes: caps.mondayMinutes ?? 0,
        tuesdayMinutes: caps.tuesdayMinutes ?? 0,
        wednesdayMinutes: caps.wednesdayMinutes ?? 0,
        thursdayMinutes: caps.thursdayMinutes ?? 0,
        fridayMinutes: caps.fridayMinutes ?? 0,
        saturdayMinutes: caps.saturdayMinutes ?? 0,
        sundayMinutes: caps.sundayMinutes ?? 0,
        preferredSessionMinutes: sessionMin,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Sao_Paulo',
      });
      // Theme is already saved on each click; this final write is idempotent and never blocks.
      await updateTheme
        .mutateAsync({ themePreference: resolvedTheme === 'dark' ? 'DARK' : 'LIGHT' })
        .catch(() => undefined);
      await refetch();
      router.replace(BTG_MEMBER_BASE);
    } catch (err) {
      setError(
        err instanceof ApiErrorResponse && err.apiError?.message
          ? err.apiError.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível salvar. Tente de novo.',
      );
    }
  }

  const s = STEPS[step]!;
  const firstName = user?.name?.split(' ')[0];

  return (
    <div className="btg-mx-onb">
      <header className="btg-topbar">
        <div className="btg-topbar-inner">
          <span className="btg-brand" aria-label="ICS Select × BTG Pactual">
            <span className="btg-brand-name">ICS Select</span>
            <span className="btg-brand-rule" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={BTG_LOGO_NAVY} alt="BTG Pactual" />
          </span>
        </div>
      </header>

      <section className="btg-hero">
        <HeroMark />
        <div className="btg-hero-inner btg-mx-onb-hero">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="btg-hero-eyebrow">Boas-vindas{firstName ? `, ${firstName}` : ''}</span>
            <h1>Quatro passos e você começa.</h1>
            <p className="btg-hero-sub">
              Sua preparação para tech de elite começa pelo básico bem feito. Nada aqui é definitivo: você ajusta tudo
              depois em Configurações.
            </p>
          </div>
        </div>
      </section>

      <main className="btg-mx-onb-main">
        <ol className="btg-mx-steps" aria-label="Progresso">
          {STEPS.map((x, i) => (
            <li key={x.label} data-state={i < step ? 'done' : i === step ? 'current' : 'todo'} aria-current={i === step ? 'step' : undefined}>
              <span className="btg-mx-step-num btg-mono">{i < step ? <Icon name="check" style={{ fontSize: 16 }} /> : i + 1}</span>
              <span className="btg-mx-step-label">{x.label}</span>
            </li>
          ))}
        </ol>

        <section className="btg-card btg-card--pad" style={{ gap: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="btg-eyebrow">Passo {step + 1} de 4 · {s.label}</span>
            <h2 style={{ fontSize: 24, lineHeight: '32px' }}>{s.title}</h2>
            <p className="btg-soft" style={{ fontSize: 15, lineHeight: '24px' }}>{s.sub}</p>
          </div>

          {step === 0 && <PhoneField value={phone} onChange={setPhone} invalid={phone.length > 0 && !phoneOk} autoFocus />}
          {step === 1 && <TrackPicker value={track} onChange={setTrack} />}
          {step === 2 && (
            <>
              <DayCaps value={caps} onChange={setCaps} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span className="btg-card-title" style={{ fontSize: 16 }}>Duração ideal da sessão</span>
                <span className="btg-mute" style={{ fontSize: 14 }}>O tamanho dos blocos em que dividimos itens mais longos.</span>
                <SessionLength value={sessionMin} onChange={setSessionMin} />
              </div>
              <div className="btg-card btg-card--ai" style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Icon name="lock" style={{ color: 'var(--btg-secondary)' }} />
                <span className="btg-soft" style={{ fontSize: 14, lineHeight: '22px' }}>
                  <strong style={{ fontWeight: 600 }}>Só você enxerga sua agenda.</strong> O agendador lê apenas os
                  horários marcados como ocupados e encaixa as sessões nos livres. Título, descrição e convidados dos seus
                  eventos ficam invisíveis para nós.
                </span>
              </div>
            </>
          )}
          {step === 3 && (
            <ThemePicker value={mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : undefined} onChange={setTheme} />
          )}

          {error && (
            <div className="btg-notice btg-notice--bad" role="alert">
              <Icon name="error" />
              {error}
            </div>
          )}
        </section>

        <nav className="btg-mx-onb-nav">
          <button
            type="button"
            className="btg-btn btg-btn--ghost"
            style={{ visibility: step === 0 ? 'hidden' : undefined }}
            onClick={() => setStep((x) => Math.max(0, x - 1))}
          >
            <Icon name="arrow_back" />
            Voltar
          </button>
          {step < 3 ? (
            <button type="button" className="btg-btn btg-btn--primary" disabled={!canAdvance} onClick={() => setStep((x) => x + 1)}>
              Continuar
              <Icon name="arrow_forward" />
            </button>
          ) : (
            <button type="button" className="btg-btn btg-btn--primary" disabled={submitting} onClick={() => void finish()}>
              {submitting ? 'Salvando…' : 'Começar minha preparação'}
              {!submitting && <Icon name="arrow_forward" />}
            </button>
          )}
        </nav>
      </main>

      <footer className="btg-mx-onb-foot btg-mute">Projeto do Inteli Consulting Society apresentado ao BTG Pactual</footer>
    </div>
  );
}
