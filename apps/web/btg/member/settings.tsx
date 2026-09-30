'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useIsMutating, useQueryClient, type Mutation } from '@tanstack/react-query';
import type { Track } from '@ics-select/shared';
import { useAuth } from '../../lib/auth/auth-context';
import { useUpdateProfile } from '../../lib/queries/me-settings';
import { useAutoSaveField } from '../../lib/forms/use-auto-save-field';
import { useThemeWithSync } from '../../lib/theme/use-theme-sync';
import { Icon, Loading } from '../ui';
import { BTG_MEMBER_BASE } from './shell';
import { PHONE_REGEX, PhoneField, ThemePicker, TrackPicker } from './member-extra-fields';

export const SETTINGS_BASE = `${BTG_MEMBER_BASE}/configuracoes`;

const TABS = [
  { href: `${SETTINGS_BASE}/perfil`, label: 'Perfil', icon: 'person' },
  { href: `${SETTINGS_BASE}/aparencia`, label: 'Aparência', icon: 'palette' },
  { href: `${SETTINGS_BASE}/disponibilidade`, label: 'Disponibilidade', icon: 'schedule' },
];

// Availability reports slot overlaps here so the save indicator can explain why nothing saves.
const OverlapContext = createContext<{ overlap: boolean; setOverlap: (v: boolean) => void }>({
  overlap: false,
  setOverlap: () => {},
});
export const useOverlapFlag = () => useContext(OverlapContext);

type SaveStatus = 'idle' | 'saving' | 'error' | 'overlap';

function SaveIndicator() {
  const qc = useQueryClient();
  const { overlap } = useOverlapFlag();
  const saving = useIsMutating({ mutationKey: ['me'] });
  const [failed, setFailed] = useState<Mutation<unknown, unknown, unknown, unknown> | null>(null);

  // Same contract as the classic GlobalSaveIndicator: any failed ['me', …] mutation
  // shows a retry link for 5s.
  useEffect(
    () =>
      qc.getMutationCache().subscribe((event) => {
        if (event.type !== 'updated') return;
        const m = event.mutation as Mutation<unknown, unknown, unknown, unknown>;
        const key = m.options.mutationKey;
        if (!Array.isArray(key) || key[0] !== 'me') return;
        if (m.state.status === 'error') setFailed(m);
        else if (m.state.status === 'success') setFailed((prev) => (prev === m ? null : prev));
      }),
    [qc],
  );
  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => setFailed(null), 5_000);
    return () => clearTimeout(t);
  }, [failed]);

  const status: SaveStatus = overlap ? 'overlap' : saving > 0 ? 'saving' : failed ? 'error' : 'idle';
  const retry = () => {
    if (!failed) return;
    void qc.getMutationCache().build(qc, failed.options).execute(failed.state.variables as never);
    setFailed(null);
  };

  const view = {
    idle: { icon: 'check_circle', color: 'var(--btg-done-easy)', text: 'Tudo salvo' },
    saving: { icon: 'progress_activity', color: 'var(--btg-text-mute)', text: 'Salvando…' },
    error: { icon: 'error', color: 'var(--btg-stuck)', text: 'Falha ao salvar' },
    overlap: { icon: 'warning', color: 'var(--btg-stuck)', text: 'Corrija a sobreposição para salvar' },
  }[status];

  return (
    <span role="status" aria-live="polite" className="btg-mx-save" style={{ color: view.color }}>
      <Icon name={view.icon} style={{ fontSize: 18 }} />
      {view.text}
      {status === 'error' && (
        <button type="button" className="btg-btn btg-btn--ghost" style={{ height: 28, padding: '0 8px' }} onClick={retry}>
          Tentar de novo
        </button>
      )}
    </span>
  );
}

export function BtgSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const [overlap, setOverlap] = useState(false);
  return (
    <OverlapContext.Provider value={{ overlap, setOverlap }}>
      <div className="btg-mx-page">
        <div className="btg-page-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="btg-eyebrow">Configurações</span>
            <h1>Suas preferências</h1>
          </div>
          <SaveIndicator />
        </div>
        <nav className="btg-tabs btg-mx-tabs" aria-label="Seções das configurações">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} aria-current={pathname.startsWith(t.href) ? 'page' : undefined}>
              <Icon name={t.icon} />
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="btg-mx-settings-body">{children}</div>
      </div>
    </OverlapContext.Provider>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="btg-card btg-card--pad">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span className="btg-card-title">{title}</span>
        {hint && <span className="btg-mute" style={{ fontSize: 14 }}>{hint}</span>}
      </div>
      {children}
    </section>
  );
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function ProfileFields({ phone, track }: { phone: string | null; track: string | null }) {
  const update = useUpdateProfile();
  const phoneField = useAutoSaveField<string>({
    initial: phone ?? '',
    debounceMs: 800,
    validate: (v) => v === '' || PHONE_REGEX.test(v),
    save: (v) => update.mutate({ whatsappPhone: v.trim() || null }),
  });
  const current = track ?? '';

  return (
    <>
      <Section title="WhatsApp" hint="Usado para os avisos do programa. Inclua o código do país.">
        <PhoneField
          value={phoneField.value}
          onChange={phoneField.onChange}
          onBlur={phoneField.onBlur}
          invalid={phoneField.invalid && phoneField.value.length > 0}
        />
      </Section>
      <Section title="Trilha de carreira" hint="Orienta o foco do seu plano de estudos neste ciclo.">
        <TrackPicker
          value={current}
          onChange={(next) => {
            if (next !== current) update.mutate({ targetTrack: (next as Track) || null });
          }}
        />
      </Section>
    </>
  );
}

export function BtgProfile() {
  const { user } = useAuth();
  if (!user) return <Loading />;
  return (
    <div className="btg-stack">
      <ProfileFields phone={user.whatsappPhone} track={user.targetTrack} />
      <Section title="Google Agenda">
        {user.googleConnected ? (
          <>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
              <span className="btg-dot" style={{ background: 'var(--btg-done-easy)' }} />
              Conectado
              {user.email && <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>{user.email}</span>}
            </span>
            <span className="btg-soft" style={{ fontSize: 14 }}>
              Seus blocos de estudo entram na agenda automaticamente quando um plano é publicado.
            </span>
            <a href={`${API_URL}/auth/google`} style={{ fontSize: 14, fontWeight: 600 }}>Reconectar</a>
          </>
        ) : (
          <div className="btg-notice btg-notice--bad" style={{ flexDirection: 'column', gap: 12 }}>
            <span>
              Sem acesso ao Google Agenda, o agendador não consegue criar seus blocos. Conecte agora para os
              planos caírem direto na sua agenda.
            </span>
            <a href={`${API_URL}/auth/google`} className="btg-btn btg-btn--primary btg-btn--sm">
              <Icon name="event" />
              Conectar Google Agenda
            </a>
          </div>
        )}
      </Section>
    </div>
  );
}

export function BtgAppearance() {
  const { resolvedTheme, setTheme, mounted } = useThemeWithSync();
  return (
    <Section title="Tema" hint="Sua escolha vale em todos os seus dispositivos.">
      <ThemePicker value={mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : undefined} onChange={setTheme} />
    </Section>
  );
}
