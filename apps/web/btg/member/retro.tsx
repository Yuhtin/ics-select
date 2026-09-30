'use client';

import { useState } from 'react';
import type { ItemOutcome } from '@ics-select/shared';
import {
  useMeRetroCurrent,
  useSubmitRetro,
  type RetroCurrentResponse,
  type WeekRecap,
} from '../../lib/queries/me-retro';
import { Icon, Loading, OUTCOMES, minutesLabel, platformOf } from '../ui';

const STUCK: ReadonlySet<ItemOutcome> = new Set(['DOUBTS', 'STUCK']);
const VALUED: ReadonlySet<ItemOutcome> = new Set(['DONE_EASY', 'DONE_HARD']);

const when = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function Recap({ recap }: { recap: WeekRecap }) {
  const { stats } = recap;
  const kpis: { label: string; value: number; color: string }[] = [
    { label: 'Mandei bem', value: stats.nailed, color: OUTCOMES.DONE_EASY.color },
    { label: 'Com esforço', value: stats.hard, color: OUTCOMES.DONE_HARD.color },
    { label: 'Dúvidas', value: stats.doubts, color: OUTCOMES.DOUBTS.color },
    { label: 'Travei', value: stats.stuck, color: OUTCOMES.STUCK.color },
    { label: 'Pulei', value: stats.skipped, color: OUTCOMES.SKIPPED.color },
  ];
  return (
    <section className="btg-card">
      <div className="btg-card-head">
        <span className="btg-card-title">Sua semana</span>
        {stats.minutesStudied > 0 && (
          <span className="btg-mono btg-mute" style={{ fontSize: 14 }}>{minutesLabel(stats.minutesStudied)} de estudo</span>
        )}
      </div>
      <div className="btg-mx-recap-kpis">
        {kpis.map((k) => (
          <div key={k.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span className="btg-mute" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="btg-dot" style={{ background: k.color }} />
              {k.label}
            </span>
            <span className="btg-mono" style={{ fontSize: 24, color: k.value > 0 ? undefined : 'var(--btg-text-mute)' }}>{k.value}</span>
          </div>
        ))}
      </div>
      {recap.items.map((it) => {
        const platform = platformOf(it.url, it.format);
        return (
          <div key={it.id} className="btg-mx-recap-row">
            <span className="btg-stripe" style={{ background: platform.color }} />
            <span style={{ flexGrow: 1, minWidth: 0, fontSize: 15 }}>{it.title}</span>
            <span className="btg-row-meta btg-mx-hide-sm">{platform.label} · {minutesLabel(it.estimatedMinutes)}</span>
            <span className="btg-row-status" style={{ width: 150, flexShrink: 0 }}>
              <span className="btg-dot" style={{ background: OUTCOMES[it.outcome].color }} />
              <span className="btg-row-status-label">{OUTCOMES[it.outcome].label}</span>
            </span>
          </div>
        );
      })}
    </section>
  );
}

function RetroForm({ data }: { data: RetroCurrentResponse }) {
  const recap = data.weekRecap ?? null;
  const [whatClicked, setWhatClicked] = useState(data.retro?.whatClicked ?? '');
  const [whatStuck, setWhatStuck] = useState(data.retro?.whatStuck ?? '');
  const [nextWeekWish, setNextWeekWish] = useState(data.retro?.nextWeekWish ?? '');
  const [valuedItemId, setValuedItemId] = useState<string | null>(data.retro?.valuedItemId ?? null);
  const [stuckItemId, setStuckItemId] = useState<string | null>(data.retro?.stuckItemId ?? null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = useSubmitRetro();

  const disabled = !data.open;
  const isUpdate = data.retro !== null;
  const stuckOptions = recap?.items.filter((i) => STUCK.has(i.outcome)) ?? [];
  const valuedOptions = recap?.items.filter((i) => VALUED.has(i.outcome)) ?? [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    try {
      await submit.mutateAsync({
        whatClicked: whatClicked.trim() || undefined,
        whatStuck: whatStuck.trim() || undefined,
        nextWeekWish: nextWeekWish.trim() || undefined,
        valuedItemId,
        stuckItemId,
      });
      setResult({ ok: true, text: `${isUpdate ? 'Retro atualizada' : 'Retro enviada'}. Suas notas já estão com o Diretor Educacional.` });
    } catch (err) {
      setResult({ ok: false, text: `Não foi possível salvar. ${err instanceof Error ? err.message : 'Tente de novo em instantes.'}` });
    }
  }

  return (
    <form className="btg-stack" onSubmit={onSubmit}>
      {!data.open && (
        <div className="btg-notice btg-mx-notice--warn">
          <Icon name="lock_clock" />
          Retro fechada. Reabre {when(data.windowOpensAt)}.
        </div>
      )}

      {recap && stuckOptions.length > 0 && (
        <fieldset className="btg-card btg-card--pad btg-mx-fieldset" disabled={disabled}>
          <span className="btg-card-title">
            <Icon name="help" style={{ color: 'var(--btg-stuck)' }} />
            Qual item travou ou deixou dúvida?
          </span>
          <select
            className="btg-select"
            aria-label="Item travado"
            value={stuckItemId ?? ''}
            onChange={(e) => setStuckItemId(e.target.value || null)}
          >
            <option value="">Escolha um item…</option>
            {stuckOptions.map((it) => (
              <option key={it.id} value={it.id}>{it.title}</option>
            ))}
          </select>
          <label className="btg-field">
            O que falta para destravar?
            <textarea className="btg-textarea" maxLength={1000} value={whatStuck} onChange={(e) => setWhatStuck(e.target.value)} />
          </label>
        </fieldset>
      )}

      {recap && (
        <fieldset className="btg-card btg-card--pad btg-mx-fieldset" disabled={disabled}>
          <span className="btg-card-title">
            <Icon name="star" style={{ color: 'var(--btg-done-easy)' }} />
            Qual item mais valeu a pena?
          </span>
          <select
            className="btg-select"
            aria-label="Item que mais valeu a pena"
            value={valuedItemId ?? ''}
            onChange={(e) => setValuedItemId(e.target.value || null)}
          >
            <option value="">Nenhum</option>
            {valuedOptions.map((it) => (
              <option key={it.id} value={it.id}>{it.title}</option>
            ))}
          </select>
          <label className="btg-field">
            Por quê?
            <textarea className="btg-textarea" maxLength={1000} value={whatClicked} onChange={(e) => setWhatClicked(e.target.value)} />
          </label>
        </fieldset>
      )}

      <fieldset className="btg-card btg-card--pad btg-mx-fieldset" disabled={disabled}>
        <span className="btg-card-title">
          <Icon name="flag" style={{ color: 'var(--btg-primary)' }} />
          Uma coisa que você quer no próximo plano
        </span>
        <textarea
          className="btg-textarea"
          aria-label="Uma coisa que você quer no próximo plano"
          style={{ minHeight: 120 }}
          maxLength={1000}
          value={nextWeekWish}
          onChange={(e) => setNextWeekWish(e.target.value)}
          placeholder="Ex.: menos LeetCode, mais system design · só 4 itens, a semana foi pesada · mais conteúdo em pt-BR"
        />
      </fieldset>

      {result && (
        <div className={`btg-notice ${result.ok ? 'btg-notice--ok' : 'btg-notice--bad'}`} role="status">
          <Icon name={result.ok ? 'check_circle' : 'error'} />
          {result.text}
        </div>
      )}

      <div>
        <button type="submit" className="btg-btn btg-btn--primary" disabled={disabled || submit.isPending}>
          {submit.isPending ? 'Salvando…' : isUpdate ? 'Atualizar retro' : 'Enviar retro'}
          <Icon name="send" />
        </button>
      </div>
    </form>
  );
}

export function BtgRetro() {
  const { data, isLoading } = useMeRetroCurrent();
  if (isLoading || !data) return <Loading />;
  return (
    <main className="btg-main btg-main--3-2">
      <div className="btg-stack" style={{ gap: 24 }}>
        <div className="btg-page-head">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span className="btg-eyebrow">Retro semanal</span>
            <h1>Como foi sua semana?</h1>
            <p className="btg-soft" style={{ fontSize: 15 }}>
              Suas notas moldam o plano da próxima semana. Só o Diretor Educacional vê o que você escreve.
            </p>
          </div>
          {data.open && data.retro && (
            <span className="btg-pill btg-pill--ok">Enviada {new Date(data.retro.submittedAt).toLocaleDateString('pt-BR')}</span>
          )}
        </div>
        <RetroForm data={data} />
      </div>
      <aside className="btg-stack">
        {data.weekRecap && <Recap recap={data.weekRecap} />}
        {data.open && (
          <section className="btg-card btg-card--pad" style={{ gap: 6 }}>
            <span className="btg-mute" style={{ fontSize: 13 }}>Janela aberta até</span>
            <span style={{ fontSize: 15 }}>{when(data.windowClosesAt)}</span>
          </section>
        )}
      </aside>
    </main>
  );
}
