'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemOutcome } from '@ics-select/shared';
import { useMeItem, useSetItemOutcome, type ItemResponse } from '../../lib/queries/me-item';
import { useMeHome } from '../../lib/queries/me-home';
import { Icon, Loading, OUTCOMES, platformOf, timeRange } from '../ui';
import { BTG_MEMBER_BASE } from './shell';

// Same rule as the classic ItemFocus: these outcomes must report time spent.
const TIME_REQUIRED: ReadonlySet<ItemOutcome> = new Set(['DONE_EASY', 'DONE_HARD', 'DOUBTS']);
const ORDER: ItemOutcome[] = ['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK', 'SKIPPED', 'PENDING'];

function youtubeId(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

function ItemView({ item }: { item: ItemResponse }) {
  const router = useRouter();
  const { data: home } = useMeHome();
  const mutation = useSetItemOutcome();
  const [outcome, setOutcome] = useState<ItemOutcome>(item.outcome);
  const [reflection, setReflection] = useState(item.reflection ?? '');
  const [minutes, setMinutes] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const lib = item.libraryItem;
  const platform = platformOf(lib.url, lib.format);
  const videoId = youtubeId(lib.url);
  const options = ORDER.filter(
    (o) => o !== 'SKIPPED' || item.outcome === 'SKIPPED' || (item.skippable && item.outcome === 'PENDING'),
  );

  // Same as classic ItemFocus: the API requires actualMinutes for these outcomes on every save.
  const requiresTime = TIME_REQUIRED.has(outcome);
  const parsedMinutes = /^\d+$/.test(minutes.trim()) ? Number(minutes) : null;
  const minutesValid = parsedMinutes !== null && parsedMinutes >= 1 && parsedMinutes <= 1440;
  const unchanged = outcome === item.outcome && reflection === (item.reflection ?? '');
  const canSave = !unchanged && (!requiresTime || minutesValid) && !mutation.isPending;

  const queue = home ? [...(home.late ?? []), ...home.today, ...home.days.flatMap((d) => d.items)] : [];
  const next = queue.find((i) => i.id !== item.id && i.outcome === 'PENDING') ?? null;

  async function save() {
    if (!canSave) return;
    setSaveError(null);
    try {
      // Wait for the API before moving on: a failed save rolls back the
      // optimistic cache, and the member must see it instead of a false "done".
      await mutation.mutateAsync({
        planId: item.planId,
        itemId: item.id,
        outcome,
        reflection: reflection.trim() === '' ? undefined : reflection,
        actualMinutes: requiresTime ? parsedMinutes : null,
      });
      router.push(next ? `${BTG_MEMBER_BASE}/item/${next.id}` : BTG_MEMBER_BASE);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Não foi possível salvar.');
    }
  }

  return (
    <main className="btg-main btg-main--item">
      <div className="btg-stack" style={{ gap: 20 }}>
        <div className="btg-mute" style={{ fontSize: 14 }}>
          <Link href={BTG_MEMBER_BASE} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="arrow_back" style={{ fontSize: 16 }} />
            Hoje
          </Link>
          {lib.topic && <> / {lib.topic.label}</>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="btg-mute" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, flexWrap: 'wrap' }}>
            <span className="btg-dot" style={{ background: platform.color }} />
            {platform.label} · {lib.estimatedMinutes} min
            {item.scheduledAt && (
              <span className="btg-pill">{timeRange(item.scheduledAt, item.scheduledMinutes)}</span>
            )}
          </div>
          <h1 style={{ fontSize: 32, lineHeight: '40px' }}>{lib.title}</h1>
        </div>

        <div className="btg-player">
          {videoId ? (
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${videoId}`}
              title={lib.title}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <>
              {lib.url ? (
                <a href={lib.url} target="_blank" rel="noopener noreferrer" className="btg-play" aria-label={`Abrir no ${platform.label}`}>
                  <Icon name="open_in_new" style={{ fontSize: 32 }} />
                </a>
              ) : (
                <span className="btg-play"><Icon name="menu_book" style={{ fontSize: 32 }} /></span>
              )}
              <span style={{ fontSize: 14 }}>
                {lib.url ? `Abrir no ${platform.label}` : 'Material sem link'}
              </span>
            </>
          )}
        </div>

        {lib.description && (
          <section className="btg-card btg-card--ai">
            <span className="btg-ai-label"><Icon name="auto_awesome" />Sobre este estudo</span>
            <p className="btg-soft" style={{ fontSize: 15, lineHeight: '24px' }}>{lib.description}</p>
          </section>
        )}

        {item.carriedFrom && (
          <section className="btg-card btg-card--pad">
            <span className="btg-ai-label"><Icon name="history" />Veio da semana passada</span>
            <p className="btg-soft" style={{ fontSize: 15, lineHeight: '24px' }}>
              {item.carriedFrom.reflection ? `“${item.carriedFrom.reflection}”` : 'Sem anotação na tentativa anterior.'}
            </p>
            <span className="btg-mute" style={{ fontSize: 13 }}>
              Marcado como {OUTCOMES[item.carriedFrom.outcome].label.toLowerCase()}
            </span>
          </section>
        )}
      </div>

      <aside className="btg-stack" style={{ gap: 16 }}>
        <section className="btg-card btg-card--pad">
          <span className="btg-card-title">Como foi?</span>
          <span className="btg-mute" style={{ fontSize: 14 }}>Sua resposta alimenta o próximo plano.</span>
          {options.map((o) => (
            <button
              key={o}
              type="button"
              className="btg-outcome-btn"
              aria-pressed={outcome === o}
              onClick={() => setOutcome(o)}
            >
              <span className="btg-dot" style={{ background: OUTCOMES[o].color }} />
              {OUTCOMES[o].label}
            </button>
          ))}
          {requiresTime && (
            <label className="btg-field">
              Tempo gasto (min)
              <input
                className="btg-input btg-mono"
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="Ex: 45"
                style={{ width: 140 }}
              />
            </label>
          )}
          {outcome !== 'PENDING' && outcome !== 'SKIPPED' && (
            <label className="btg-field">
              Anotação (opcional)
              <textarea
                className="btg-textarea"
                rows={3}
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Escreva em pt-BR, é sua nota."
              />
            </label>
          )}
          {saveError && (
            <div className="btg-notice btg-notice--bad" role="alert">
              <Icon name="error" />
              Não salvou: {saveError}. Seu resultado continua como estava.
            </div>
          )}
          <button type="button" className="btg-btn btg-btn--primary" disabled={!canSave} onClick={() => void save()}>
            {mutation.isPending ? 'Salvando…' : next ? 'Salvar e ir para o próximo' : 'Salvar'}
            <Icon name="arrow_forward" />
          </button>
          {outcome === 'STUCK' && (
            <span className="btg-mute" style={{ fontSize: 13 }}>
              O Diretor Educacional é avisado quando você marca que travou.
            </span>
          )}
        </section>

        {next && (
          <section className="btg-card btg-card--pad" style={{ gap: 10, padding: '20px 24px' }}>
            <span className="btg-mute" style={{ fontSize: 14 }}>A seguir</span>
            <Link
              href={`${BTG_MEMBER_BASE}/item/${next.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'inherit' }}
            >
              <span className="btg-stripe" style={{ background: platformOf(next.url, next.format).color }} />
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15 }}>{next.title}</span>
                <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>
                  {timeRange(next.scheduledAt, next.scheduledMinutes)}
                </span>
              </span>
            </Link>
          </section>
        )}
      </aside>
    </main>
  );
}

export function BtgItem({ id }: { id: string }) {
  const { data, isLoading, error } = useMeItem(id);
  if (isLoading) return <Loading />;
  if (error || !data) return <Loading label="Item não encontrado." />;
  // key resets the form state when navigating item → next item.
  return <ItemView key={data.id} item={data} />;
}
