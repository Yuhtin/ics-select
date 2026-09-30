'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toPng } from 'html-to-image';
import { ApiErrorResponse } from '../../lib/api/client';
import { useCycleReceipt, type CycleReceiptResponse, type ReceiptMode } from '../../lib/queries/admin-cycle-receipt';
import { BTG_LOGO_WHITE, HeroMark, Icon, Loading } from '../ui';
import { shortDate } from './cycles-ui';
import { BTG_ADMIN_BASE } from './shell';

const CAPTURE_ID = 'btg-receipt-capture';
const fmtHours = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
const fmtPct = (p: number) => `${Math.round(p * 100)}%`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const shortName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return parts.length <= 1 ? full : `${parts[0]} ${parts[parts.length - 1]}`;
};
const daysBetween = (a: string, b: string) =>
  Math.abs(new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000;

type Fame = { key: string; label: string; name: string; detail: string };
function hallOfFame(d: CycleReceiptResponse): Fame[] {
  const rows: Array<Fame | null> = [
    d.engagementLeader && { key: 'eng', label: 'Maior engajamento', name: d.engagementLeader.name, detail: `nota ${Math.round(d.engagementLeader.score)}` },
    d.streakChampion && { key: 'streak', label: 'Maior sequência', name: d.streakChampion.name, detail: plural(d.streakChampion.streakDays, 'dia', 'dias') },
    d.mostHoursStudied && { key: 'hours', label: 'Mais horas', name: d.mostHoursStudied.name, detail: fmtHours(d.mostHoursStudied.minutes) },
    d.mostItemsCompleted && { key: 'items', label: 'Mais itens concluídos', name: d.mostItemsCompleted.name, detail: plural(d.mostItemsCompleted.items, 'item', 'itens') },
    d.polymath && { key: 'poly', label: 'Mais tópicos', name: d.polymath.name, detail: plural(d.polymath.topics, 'tópico', 'tópicos') },
    d.mostActiveDays && { key: 'days', label: 'Mais dias ativos', name: d.mostActiveDays.name, detail: plural(d.mostActiveDays.days, 'dia', 'dias') },
    d.marathonDay && { key: 'marathon', label: 'Dia maratona', name: d.marathonDay.name, detail: `${plural(d.marathonDay.items, 'item', 'itens')} em um dia` },
    d.longestItem && { key: 'long', label: 'Fôlego longo', name: d.longestItem.name, detail: `item de ${fmtHours(d.longestItem.minutes)}` },
  ];
  return rows.filter((r): r is Fame => r !== null);
}

function KnowledgeGrid({ data, inverted }: { data: CycleReceiptResponse['knowledgeGrid']; inverted?: boolean }) {
  const cells = new Map(data.cells.map((c) => [`${c.userId}|${c.topicId}`, c]));
  const muted = inverted ? 'rgba(255,255,255,0.64)' : 'var(--btg-text-mute)';
  if (data.members.length === 0) return <span style={{ color: muted, fontSize: 13 }}>Nenhum membro neste ciclo.</span>;
  if (data.topics.length === 0) return <span style={{ color: muted, fontSize: 13 }}>Nada estudado ainda.</span>;
  const color = (n: number) =>
    n === 0 ? (inverted ? 'rgba(255,255,255,0.16)' : 'var(--btg-border-soft)') : n === 1 ? 'var(--btg-blue-300)' : inverted ? '#fff' : 'var(--btg-primary)';
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="btg-ac-kgrid" style={{ color: inverted ? '#fff' : undefined }}>
        <thead>
          <tr>
            <th style={{ width: 140 }} />
            {data.topics.map((t) => (
              <th key={t.topicId} title={t.label}>
                <span style={inverted ? { color: 'rgba(255,255,255,0.8)' } : undefined}>
                  {t.label.length > 18 ? `${t.label.slice(0, 17)}…` : t.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.members.map((m) => (
            <tr key={m.userId}>
              <td title={m.name}>{shortName(m.name)}</td>
              {data.topics.map((t) => {
                const c = cells.get(`${m.userId}|${t.topicId}`);
                return (
                  <td key={t.topicId} title={c?.hasStuckOrDoubts ? 'Travou ou ficou com dúvidas neste tópico' : undefined}>
                    <span
                      className="btg-ac-kdot"
                      style={{ background: color(c?.itemsDone ?? 0), outline: c?.hasStuckOrDoubts ? '1px solid var(--btg-doubts)' : undefined }}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
          <tr>
            <td style={{ color: muted, paddingTop: 8 }}>Total</td>
            {data.topics.map((t) => (
              <td key={t.topicId} className="btg-mono" style={{ color: muted, paddingTop: 8 }}>
                {data.members.filter((m) => (cells.get(`${m.userId}|${t.topicId}`)?.itemsDone ?? 0) > 0).length}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function Leader({ label, value }: { label: string; value: string }) {
  return (
    <div className="btg-ac-leader">
      <span>{label}</span>
      <span aria-hidden="true" />
      <span className="btg-mono">{value}</span>
    </div>
  );
}

function Statement({ data }: { data: CycleReceiptResponse }) {
  const t = data.totals;
  const topics = data.byTopic.slice(0, 12);
  const asOf = new Date(data.asOf);
  const fame = hallOfFame(data);
  const early = data.cycle.weekNumber <= 1 && t.itemsCompleted < 5;
  const time = asOf.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });

  return (
    <article id={CAPTURE_ID} className="btg-ac-paper">
      <header className="btg-ac-paper-head">
        <HeroMark />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BTG_LOGO_WHITE} alt="BTG Pactual" className="btg-ac-logo" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
          <span className="btg-hero-eyebrow">ICS Select · Extrato do ciclo</span>
          <span style={{ fontSize: 32, lineHeight: '40px' }}>{data.cycle.name}</span>
          <span className="btg-mono" style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)' }}>
            {asOf.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · semana {data.cycle.weekNumber} de{' '}
            {data.cycle.weeksTotal} · {time} BRT
          </span>
        </div>
      </header>

      <div className="btg-ac-paper-body">
        {early && (
          <div className="btg-notice btg-ac-notice--warn" style={{ marginTop: 16 }}>
            Início de ciclo: os números ainda vão crescer.
          </div>
        )}

        <section className="btg-ac-paper-section">
          <span className="btg-eyebrow">Consolidado</span>
          <Leader label="Membros na turma" value={String(t.members)} />
          <Leader label="Horas de estudo" value={fmtHours(t.totalMinutes)} />
          <Leader label="Média por membro" value={fmtHours(t.avgMinutesPerMember)} />
          <Leader label="Itens concluídos" value={String(t.itemsCompleted)} />
          <Leader label="Retros enviadas" value={String(t.retros)} />
          <Leader label="Aulas realizadas" value={`${t.classesHeld} / ${t.classesTotal}`} />
          <Leader label="Presença" value={fmtPct(t.attendanceRate)} />
        </section>

        <section className="btg-ac-paper-section">
          <span className="btg-eyebrow">Por tópico · membros que chegaram</span>
          {topics.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Nada estudado ainda.</span>}
          {topics.map((b) => (
            <div key={b.topicId} className="btg-ac-topic">
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</span>
              <div className="btg-track"><div style={{ width: fmtPct(b.coveragePct) }} /></div>
              <span className="btg-mono" style={{ textAlign: 'right' }}>{fmtPct(b.coveragePct)}</span>
            </div>
          ))}
          {data.byTopic.length > topics.length && (
            <span className="btg-mute" style={{ fontSize: 13 }}>+{data.byTopic.length - topics.length} tópicos</span>
          )}
        </section>

        <section className="btg-ac-paper-section">
          <span className="btg-eyebrow">Mapa de conhecimento</span>
          <KnowledgeGrid data={data.knowledgeGrid} />
        </section>

        {data.topMovers.length > 0 && (
          <section className="btg-ac-paper-section">
            <span className="btg-eyebrow">Quem mais avançou · últimos 7 dias</span>
            {data.topMovers.map((m) => (
              <div key={m.userId} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 14 }}>
                <span style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  {m.name}
                  <span className="btg-mono" style={{ color: 'var(--btg-done-easy)' }}>+{plural(m.deltaItems, 'item', 'itens')}</span>
                </span>
                {m.topTopics.length > 0 && <span className="btg-mute" style={{ fontSize: 13 }}>{m.topTopics.join(', ')}</span>}
              </div>
            ))}
          </section>
        )}

        <section className="btg-ac-paper-section">
          <span className="btg-eyebrow">Quadro de honra</span>
          {fame.length === 0 && <span className="btg-mute" style={{ fontSize: 14 }}>Nenhum destaque ainda. O longo prazo começa agora.</span>}
          {fame.map((f) => (
            <div key={f.key} className="btg-ac-fame">
              <span className="btg-soft">{f.label}</span>
              <span>{f.name}</span>
              <span className="btg-mono btg-mute">{f.detail}</span>
            </div>
          ))}
          {data.perfectAttendance.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
              <span className="btg-soft" style={{ fontSize: 13 }}>Presença perfeita</span>
              <span style={{ fontSize: 14 }}>{data.perfectAttendance.map((m) => m.name).join(' · ')}</span>
            </div>
          )}
        </section>

        <footer style={{ padding: '24px 0 0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 15 }}>Obrigado por estudar. Excelência é construída no longo prazo.</span>
          <span className="btg-mute" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            by davi duarte · github.com/Yuhtin
          </span>
        </footer>
      </div>
    </article>
  );
}

function Slide({ bg, children, dark = true }: { bg: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <section className="btg-ac-slide" style={{ background: bg, color: dark ? '#fff' : 'var(--btg-logo-navy)' }}>
      {children}
    </section>
  );
}

function Retrospective({ data }: { data: CycleReceiptResponse }) {
  const top = [...data.byTopic].sort((a, b) => b.membersReached - a.membersReached || b.itemsCompleted - a.itemsCompleted)[0];
  const eyebrow = { fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'var(--btg-blue-300)', fontWeight: 600 };
  return (
    <div id={CAPTURE_ID} className="btg-ac-wrapped">
      <Slide bg="var(--btg-navy-900)">
        <HeroMark />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={BTG_LOGO_WHITE} alt="BTG Pactual" style={{ height: 28, width: 'auto' }} />
        <span style={eyebrow}>{data.cycle.weeksTotal} semanas · {data.totals.members} mentes</span>
        <h2>{data.cycle.name}</h2>
        <span className="btg-mono" style={{ opacity: 0.8 }}>encerrado em {shortDate(data.cycle.endsAt, true)}</span>
      </Slide>

      <Slide bg="var(--btg-primary)">
        <span style={{ ...eyebrow, color: 'var(--btg-blue-100)' }}>juntos, vocês estudaram</span>
        <span className="btg-ac-big btg-mono">{fmtHours(data.totals.totalMinutes)}</span>
        <span style={{ opacity: 0.9 }}>{plural(data.totals.itemsCompleted, 'item concluído', 'itens concluídos')}, um de cada vez.</span>
      </Slide>

      {top && (
        <Slide bg="var(--btg-navy-800)">
          <span style={eyebrow}>tópico mais dominado</span>
          <h2>{top.label}</h2>
          <span style={{ opacity: 0.9 }}>
            {top.membersReached} de {data.totals.members} chegaram lá · {plural(top.itemsCompleted, 'item', 'itens')} concluídos
          </span>
        </Slide>
      )}

      {data.cycleTopMover && (
        <Slide bg="var(--btg-secondary)">
          <span style={{ ...eyebrow, color: 'var(--btg-blue-100)' }}>quem mais avançou no ciclo</span>
          <h2>{data.cycleTopMover.name}</h2>
          <span style={{ opacity: 0.9 }}>
            +{plural(data.cycleTopMover.deltaItems, 'item', 'itens')}
            {data.cycleTopMover.topTopics.length > 0 ? ` · ${data.cycleTopMover.topTopics.join(', ')}` : ''}
          </span>
        </Slide>
      )}

      <Slide bg="var(--btg-navy-900)">
        <span style={eyebrow}>a turma</span>
        <KnowledgeGrid data={data.knowledgeGrid} inverted />
      </Slide>

      <Slide bg="var(--btg-primary)">
        <span style={{ ...eyebrow, color: 'var(--btg-blue-100)' }}>quadro de honra</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 24, width: '100%', textAlign: 'left' }}>
          {hallOfFame(data).map((f) => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.72 }}>{f.label}</span>
              <span style={{ fontSize: 24, fontWeight: 600 }}>{f.name}</span>
              <span className="btg-mono" style={{ fontSize: 13, opacity: 0.8 }}>{f.detail}</span>
            </div>
          ))}
        </div>
        {data.perfectAttendance.length > 0 && (
          <span style={{ fontSize: 14, opacity: 0.9 }}>Presença perfeita: {data.perfectAttendance.map((m) => m.name).join(', ')}</span>
        )}
      </Slide>

      <Slide bg="var(--btg-blue-50)" dark={false}>
        <span className="btg-eyebrow">{data.cycle.name}</span>
        <h2>Ciclo encerrado</h2>
        <span className="btg-soft">Meritocracia se prova no próximo ciclo. Até lá.</span>
        <span className="btg-mute" style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 24 }}>
          by davi duarte · github.com/Yuhtin
        </span>
      </Slide>
    </div>
  );
}

export function BtgReceipt({ cycleId }: { cycleId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const asOfParam = sp.get('asOf') ?? undefined;
  const modeParam = sp.get('mode');
  const { data, isLoading, error } = useCycleReceipt(cycleId, asOfParam);
  const [downloading, setDownloading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next}`);
  };

  const back = (
    <Link href={`${BTG_ADMIN_BASE}/cycle/${cycleId}`} aria-label="Voltar ao ciclo" className="btg-icon-btn" style={{ border: '1px solid var(--btg-border)' }}>
      <Icon name="arrow_back" />
    </Link>
  );

  if (isLoading) return <Loading label="Carregando resumo…" />;
  if (error || !data) {
    const code = error instanceof ApiErrorResponse ? error.apiError?.code : null;
    const message =
      code === 'CYCLE_NOT_STARTED'
        ? 'O ciclo ainda não começou. O resumo abre na primeira semana.'
        : code === 'INVALID_AS_OF'
          ? 'Essa data está fora do período do ciclo.'
          : 'Não foi possível carregar o resumo.';
    return (
      <>
        <header className="btg-admin-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {back}
            <div className="btg-admin-header-title"><span>Resumo do ciclo</span><span>Indisponível</span></div>
          </div>
          {code === 'INVALID_AS_OF' && (
            <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => setParam('asOf', null)}>
              Voltar para hoje
            </button>
          )}
        </header>
        <main className="btg-ac-main">
          <div className="btg-notice btg-notice--bad"><Icon name="error" />{message}</div>
        </main>
      </>
    );
  }

  const mode: ReceiptMode = modeParam === 'thermal' || modeParam === 'wrapped' ? modeParam : data.mode;
  const asOfValue = (asOfParam ?? data.asOf).slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const endDate = data.cycle.endsAt.slice(0, 10);
  const showModeToggle = mode === 'wrapped' || data.cycle.status === 'ARCHIVED' || daysBetween(asOfValue, endDate) <= 2;

  async function download() {
    const target = document.getElementById(CAPTURE_ID);
    if (!target) return;
    setDownloading(true);
    setExportError(null);
    try {
      const url = await toPng(target, { pixelRatio: 2, backgroundColor: '#F5F5F6' });
      const a = document.createElement('a');
      a.href = url;
      a.download = `ciclo-${cycleId.slice(-6)}-resumo-${asOfValue}.png`;
      a.click();
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'falha ao gerar a imagem');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <>
      <header className="btg-admin-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {back}
          <div className="btg-admin-header-title">
            <span>{data.cycle.name}</span>
            <span>{mode === 'wrapped' ? 'Retrospectiva do ciclo' : 'Extrato do ciclo'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="btg-field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            Posição em
            <input
              type="date"
              className="btg-input btg-mono"
              style={{ height: 40, width: 'auto' }}
              value={asOfValue}
              min={data.cycle.startsAt.slice(0, 10)}
              max={today < endDate ? today : endDate}
              onChange={(e) => e.target.value && setParam('asOf', e.target.value)}
            />
          </label>
          {showModeToggle && (
            <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => setParam('mode', mode === 'wrapped' ? 'thermal' : 'wrapped')}>
              <Icon name={mode === 'wrapped' ? 'receipt_long' : 'slideshow'} />
              {mode === 'wrapped' ? 'Ver extrato' : 'Ver retrospectiva'}
            </button>
          )}
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => void download()} disabled={downloading}>
            <Icon name="download" />
            {downloading ? 'Gerando…' : 'Baixar PNG'}
          </button>
        </div>
      </header>
      {exportError && (
        <div className="btg-notice btg-notice--bad" role="alert" style={{ margin: '16px 40px 0' }}>
          <Icon name="error" />
          Não foi possível gerar o PNG: {exportError}.
        </div>
      )}
      <main className="btg-ac-main">{mode === 'wrapped' ? <Retrospective data={data} /> : <Statement data={data} />}</main>
    </>
  );
}
