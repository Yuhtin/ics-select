'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, setAccessToken } from '../lib/api/client';
import { BTG_LOGO_NAVY, HeroMark, Icon } from './ui';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TOKEN_KEY = 'ics_access_token'; // same key lib/api/client.ts writes

/**
 * BTG sign-in without touching the classic auth flow: Google OAuth runs in a
 * popup that ends on the classic /auth/callback, which writes the token to
 * localStorage. This page hears that write via the `storage` event (fired in
 * other windows of the same origin), tries to close the popup (Google's COOP
 * can sever the handle, hence the hint in the UI) and reloads in place,
 * so the user never leaves /btg-poc or /btgadmin-poc.
 */
export function BtgLogin({ area, reconnect = false }: { area: 'member' | 'admin'; reconnect?: boolean }) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    let popup: Window | null = null;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== TOKEN_KEY || !e.newValue) return;
      popup?.close();
      window.location.reload();
    };
    window.addEventListener('storage', onStorage);
    const btn = document.getElementById('btg-login-btn');
    const open = () => {
      popup = window.open(`${API_BASE}/auth/google`, 'btg-login', 'width=520,height=680');
      setBlocked(!popup);
    };
    btn?.addEventListener('click', open);
    return () => {
      window.removeEventListener('storage', onStorage);
      btn?.removeEventListener('click', open);
    };
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: 'var(--btg-navy-900)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <HeroMark />
      <section className="btg-card btg-card--pad" style={{ position: 'relative', width: 400, maxWidth: '100%', padding: 32, gap: 20 }}>
        <div className="btg-brand">
          <span className="btg-brand-name">ICS Select</span>
          <span className="btg-brand-rule" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BTG_LOGO_NAVY} alt="BTG Pactual" />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="btg-eyebrow">
            {reconnect ? 'Reconexão necessária' : area === 'admin' ? 'Diretor Educacional' : 'Programa seletivo'}
          </span>
          <h1 style={{ fontSize: 24, lineHeight: '32px' }}>
            {reconnect ? 'Reconecte sua Agenda Google' : 'Entre para continuar'}
          </h1>
          <p className="btg-soft" style={{ fontSize: 15 }}>
            {reconnect
              ? 'Entre com o Google mais uma vez para que seus blocos de estudo sejam criados e atualizados na sua agenda.'
              : 'Use sua conta Google do Inteli. O acesso é só para quem foi convidado.'}
          </p>
        </div>
        <button id="btg-login-btn" type="button" className="btg-btn btg-btn--primary">
          <Icon name="login" />
          {reconnect ? 'Reconectar Google' : 'Entrar com Google'}
        </button>
        <p className="btg-mute" style={{ fontSize: 13 }}>
          O login abre numa janela separada. Depois de entrar, esta página atualiza sozinha e você pode fechar a outra janela.
        </p>
        {blocked && (
          <div className="btg-notice btg-notice--bad">
            <Icon name="error" />
            <span>
              O navegador bloqueou a janela de login. Libere pop-ups para este site ou{' '}
              <a href={`${API_BASE}/auth/google`}>entre nesta aba</a> (você volta pelo app clássico).
            </span>
          </div>
        )}
      </section>
    </main>
  );
}

/** Logout that lands back on the BTG sign-in instead of the classic /login. */
export function useBtgLogout(home: string) {
  const qc = useQueryClient();
  return async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    qc.clear();
    window.location.href = home;
  };
}
