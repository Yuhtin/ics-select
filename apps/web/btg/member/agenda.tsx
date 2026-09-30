'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useMeCalendarWeek,
  useRescheduleEvent,
  type CalendarEvent,
} from '../../lib/queries/me-calendar';
import { isoToSxLocal, sxLocalToIso, sxToDatetimeLocal, datetimeLocalToSx } from '../../lib/calendar/sx-time';
import { Icon, Loading, Modal, OUTCOMES, platformOf } from '../ui';
import { BTG_MEMBER_BASE } from './shell';

const START_H = 7;
const END_H = 24;
const HOUR_PX = 48;
const START_MIN = START_H * 60;
const END_MIN = END_H * 60;
const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function sundayOf(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Date key + minute of day for an instant, in the member's calendar timezone.
function zoned(iso: string, tz: string): { key: string; min: number } {
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))) p[x.type] = x.value;
  return { key: `${p.year}-${p.month}-${p.day}`, min: (Number(p.hour) % 24) * 60 + Number(p.minute) };
}
const hhmm = (iso: string, tz: string) =>
  new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz }).format(new Date(iso));

type Placed = { event: CalendarEvent; startMin: number; endMin: number; lane: number; size: number };

// Overlapping events share the column side by side, Google Calendar style.
function layoutDay(list: Omit<Placed, 'lane' | 'size'>[]): Placed[] {
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Placed[] = [];
  let cluster: Omit<Placed, 'size'>[] = [];
  let lanes: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const size = Math.max(0, ...cluster.map((c) => c.lane)) + 1;
    for (const c of cluster) out.push({ ...c, size });
    cluster = [];
    lanes = [];
  };
  for (const ev of sorted) {
    if (ev.startMin >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    let lane = lanes.findIndex((end) => end <= ev.startMin);
    if (lane === -1) lane = lanes.push(ev.endMin) - 1;
    else lanes[lane] = ev.endMin;
    clusterEnd = Math.max(clusterEnd, ev.endMin);
    cluster.push({ ...ev, lane });
  }
  flush();
  return out;
}

function outcomeColor(e: CalendarEvent) {
  return OUTCOMES[e.ics?.outcome ?? 'PENDING'].color;
}

function WeekGrid({
  weekStart,
  tz,
  events,
  onReschedule,
}: {
  weekStart: Date;
  tz: string;
  events: CalendarEvent[];
  onReschedule: (e: CalendarEvent) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (10 - START_H) * HOUR_PX;
  }, []);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const { timed, allDay } = useMemo(() => {
    const byDay = new Map<string, Omit<Placed, 'lane' | 'size'>[]>();
    const allDay = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const s = zoned(e.start, tz);
      if (e.allDay) {
        allDay.set(s.key, [...(allDay.get(s.key) ?? []), e]);
        continue;
      }
      let endMin = zoned(e.end, tz).min;
      if (endMin <= s.min) endMin = s.min + 15;
      byDay.set(s.key, [...(byDay.get(s.key) ?? []), { event: e, startMin: s.min, endMin }]);
    }
    const timed = new Map([...byDay].map(([k, list]) => [k, layoutDay(list)]));
    return { timed, allDay };
  }, [events, tz]);

  const todayKey = dateKey(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();

  return (
    <section className="btg-card btg-mx-grid-card">
      <div className="btg-mx-grid-scroll-x">
        <div className="btg-mx-grid-inner">
          <div className="btg-mx-grid-row btg-mx-grid-head">
            <span />
            {days.map((d) => (
              <span key={d.toISOString()} className="btg-mx-grid-day">
                <span className="btg-eyebrow">{WEEKDAYS[d.getDay()]}</span>
                <span className="btg-mono" data-today={dateKey(d) === todayKey}>{d.getDate()}</span>
              </span>
            ))}
          </div>
          {allDay.size > 0 && (
            <div className="btg-mx-grid-row btg-mx-grid-allday">
              <span className="btg-mute" style={{ fontSize: 11, textAlign: 'right', paddingRight: 8 }}>dia todo</span>
              {days.map((d) => (
                <span key={d.toISOString()} className="btg-mx-grid-allday-cell">
                  {(allDay.get(dateKey(d)) ?? []).map((e) => (
                    <span key={e.id} className="btg-pill btg-pill--neutral" title={e.title} style={{ maxWidth: '100%', overflow: 'hidden' }}>
                      {e.title}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          )}
          <div ref={scrollRef} className="btg-mx-grid-body">
            <div className="btg-mx-grid-row" style={{ height: (END_H - START_H) * HOUR_PX, position: 'relative' }}>
              <div style={{ position: 'relative' }}>
                {Array.from({ length: END_H - START_H + 1 }, (_, i) => (
                  <span key={i} className="btg-mono btg-mute btg-mx-grid-hour" style={{ top: i * HOUR_PX }}>
                    {String((START_H + i) % 24).padStart(2, '0')}
                  </span>
                ))}
              </div>
              {days.map((d) => {
                const key = dateKey(d);
                const isToday = key === todayKey;
                return (
                  <div key={key} className="btg-mx-grid-col" data-today={isToday}>
                    {Array.from({ length: END_H - START_H }, (_, i) => (
                      <span key={i} className="btg-mx-grid-line" style={{ top: i * HOUR_PX }} />
                    ))}
                    {isToday && nowMin >= START_MIN && (
                      <span className="btg-mx-grid-now" style={{ top: ((nowMin - START_MIN) * HOUR_PX) / 60 }} />
                    )}
                    {(timed.get(key) ?? []).map((p) => {
                      const s = Math.max(p.startMin, START_MIN);
                      const e = Math.min(p.endMin, END_MIN);
                      if (e <= s) return null;
                      const height = Math.max(((e - s) * HOUR_PX) / 60, 22);
                      const cascade = p.size >= 3;
                      const width = cascade ? 70 : 100 / p.size;
                      const left = cascade ? 14 * p.lane : p.lane * width;
                      const ics = p.event.kind === 'ICS';
                      const link = p.event.meetLink ?? p.event.htmlLink;
                      const label = `${hhmm(p.event.start, tz)}–${hhmm(p.event.end, tz)}`;
                      const style = {
                        top: ((s - START_MIN) * HOUR_PX) / 60,
                        height,
                        left: `${left}%`,
                        width: `calc(${width}% - 2px)`,
                        zIndex: cascade ? 5 + p.lane : 1,
                      };
                      return ics ? (
                        <button
                          key={p.event.id}
                          type="button"
                          className="btg-mx-ev btg-mx-ev--ics"
                          style={{ ...style, borderLeftColor: platformOf(p.event.ics?.url, p.event.ics?.format).color }}
                          title={`${p.event.title} · ${label} · clique para remarcar`}
                          onClick={() => onReschedule(p.event)}
                        >
                          <span className="btg-dot btg-mx-ev-dot" style={{ background: outcomeColor(p.event) }} />
                          <span className="btg-mx-ev-title">{height >= 32 ? p.event.title : label.split('–')[0]}</span>
                          {height >= 40 && <span className="btg-mono btg-mx-ev-meta">{label}</span>}
                        </button>
                      ) : (
                        <div key={p.event.id} className="btg-mx-ev btg-mx-ev--ext" style={style} title={`${p.event.title} · ${label}`}>
                          <span className="btg-mx-ev-title">{height >= 32 ? p.event.title : label.split('–')[0]}</span>
                          {height >= 40 && (
                            <span className="btg-mono btg-mx-ev-meta">
                              {label}
                              {p.event.location && ` · ${p.event.location}`}
                            </span>
                          )}
                          {link && height >= 32 && (
                            <a href={link} target="_blank" rel="noreferrer" className="btg-mx-ev-link" aria-label="Abrir evento">
                              <Icon name={p.event.meetLink ? 'videocam' : 'open_in_new'} style={{ fontSize: 14 }} />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="btg-mx-legend">
        <span className="btg-eyebrow">Legenda</span>
        {(['PENDING', 'DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK', 'SKIPPED'] as const).map((o) => (
          <span key={o} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span className="btg-dot" style={{ background: OUTCOMES[o].color }} />
            {OUTCOMES[o].label}
          </span>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span className="btg-mx-legend-ext" />
          Google Agenda
        </span>
      </div>
    </section>
  );
}

function WeekList({ events, tz, onReschedule }: { events: CalendarEvent[]; tz: string; onReschedule: (e: CalendarEvent) => void }) {
  const ics = events.filter((e) => e.kind === 'ICS');
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of ics) {
    const label = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz }).format(new Date(e.start));
    byDay.set(label, [...(byDay.get(label) ?? []), e]);
  }
  return (
    <section className="btg-card">
      <div className="btg-card-head">
        <span className="btg-card-title">Blocos de estudo</span>
        <span className="btg-mono btg-mute" style={{ fontSize: 14 }}>{ics.length}</span>
      </div>
      {ics.length === 0 && <p className="btg-empty">Nenhum bloco de estudo nesta semana.</p>}
      {[...byDay].map(([day, list]) => (
        <div key={day} style={{ padding: '12px 16px 4px' }}>
          <span className="btg-eyebrow">{day}</span>
          {list.map((e) => (
            <div key={e.id} className="btg-mx-list-row">
              <Link href={`${BTG_MEMBER_BASE}/item/${e.ics?.itemId}`} className="btg-mx-list-link">
                <span className="btg-stripe" style={{ background: platformOf(e.ics?.url, e.ics?.format).color, height: 28 }} />
                <span className="btg-dot" style={{ background: outcomeColor(e) }} />
                <span style={{ flexGrow: 1, minWidth: 0, fontSize: 14 }} className="btg-mx-ellipsis">{e.title}</span>
                <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{hhmm(e.start, tz)}</span>
              </Link>
              <button type="button" className="btg-icon-btn" aria-label={`Remarcar ${e.title}`} title="Remarcar" onClick={() => onReschedule(e)}>
                <Icon name="event_repeat" style={{ fontSize: 18 }} />
              </button>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}

function RescheduleModal({
  event,
  tz,
  onClose,
  onSubmit,
}: {
  event: CalendarEvent | null;
  tz: string;
  onClose: () => void;
  onSubmit: (input: { eventId: string; start: string; end: string }) => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setStart(sxToDatetimeLocal(isoToSxLocal(event.start, tz)));
    setEnd(sxToDatetimeLocal(isoToSxLocal(event.end, tz)));
    setError(null);
  }, [event, tz]);

  function submit() {
    if (!event) return;
    if (!start || !end) return setError('Preencha os dois horários.');
    const startIso = sxLocalToIso(datetimeLocalToSx(start), tz);
    const endIso = sxLocalToIso(datetimeLocalToSx(end), tz);
    if (new Date(endIso) <= new Date(startIso)) return setError('O fim precisa ser depois do início.');
    onSubmit({ eventId: event.id, start: startIso, end: endIso });
    onClose();
  }

  return (
    <Modal
      open={!!event}
      onClose={onClose}
      title="Remarcar bloco"
      width={440}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={submit}>Remarcar</button>
        </>
      }
    >
      <span style={{ fontSize: 15 }}>{event?.title}</span>
      <label className="btg-field">
        Início
        <input type="datetime-local" className="btg-input btg-mono" value={start} onChange={(e) => setStart(e.target.value)} />
      </label>
      <label className="btg-field">
        Fim
        <input type="datetime-local" className="btg-input btg-mono" value={end} onChange={(e) => setEnd(e.target.value)} />
      </label>
      {error && (
        <span role="alert" style={{ color: 'var(--btg-stuck)', fontSize: 14 }}>{error}</span>
      )}
      <span className="btg-mute" style={{ fontSize: 13 }}>O evento também muda no seu Google Agenda.</span>
    </Modal>
  );
}

export function BtgAgenda() {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => sundayOf(new Date()));
  const { data, isLoading, isFetching } = useMeCalendarWeek(weekStart);
  const reschedule = useRescheduleEvent(weekStart);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const tz = data?.timezone ?? 'America/Sao_Paulo';

  const weekEnd = addDays(weekStart, 6);
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });

  return (
    <div className="btg-mx-page btg-mx-page--wide">
      <div className="btg-page-head">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="btg-eyebrow">Agenda</span>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="btg-mono" style={{ fontSize: 28 }}>{fmt(weekStart)} – {fmt(weekEnd)}</span>
            {isFetching && !isLoading && <span className="btg-dot btg-mx-pulse" aria-label="Atualizando" style={{ background: 'var(--btg-pending)' }} />}
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" aria-label="Semana anterior" onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <Icon name="chevron_left" />
          </button>
          <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" onClick={() => setWeekStart(sundayOf(new Date()))}>
            Hoje
          </button>
          <button type="button" className="btg-btn btg-btn--outline btg-btn--sm" aria-label="Próxima semana" onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>

      {reschedule.isError && (
        <div className="btg-notice btg-notice--bad" role="alert">
          <Icon name="error" />
          Não foi possível remarcar. O horário anterior foi mantido.
        </div>
      )}

      {!data ? (
        <Loading />
      ) : (
        <>
          {!data.hasGoogleConnection && (
            <div className="btg-notice btg-mx-notice--warn" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
              <span>Conecte seu Google Agenda para ver sua semana aqui.</span>
              <a href={`${API_URL}/auth/google`} className="btg-btn btg-btn--primary btg-btn--sm">Conectar Google Agenda</a>
            </div>
          )}
          <div className="btg-mx-agenda">
            <WeekList events={data.events} tz={tz} onReschedule={setEditing} />
            <WeekGrid weekStart={weekStart} tz={tz} events={data.events} onReschedule={setEditing} />
          </div>
        </>
      )}

      <RescheduleModal
        event={editing}
        tz={tz}
        onClose={() => setEditing(null)}
        onSubmit={(input) =>
          reschedule.mutate(input, { onSettled: () => void qc.invalidateQueries({ queryKey: ['me', 'home'] }) })
        }
      />
    </div>
  );
}
