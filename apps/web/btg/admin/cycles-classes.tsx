'use client';

import { useEffect, useState } from 'react';
import {
  useCycleClasses,
  useScheduleClass,
  useSubmitAttendance,
  type AttendanceStatus,
  type ClassSession,
} from '../../lib/queries/admin-classes';
import { Avatar, Icon, Modal } from '../ui';

type Member = { userId: string; name: string; pictureUrl: string | null };

const STATUS: Array<{ value: AttendanceStatus; label: string }> = [
  { value: 'PRESENT', label: 'Presente' },
  { value: 'LATE', label: 'Atrasado' },
  { value: 'ABSENT', label: 'Faltou' },
];

const when = (iso: string) =>
  new Date(iso)
    .toLocaleString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    .replace('.', '');

function ScheduleModal({ cycleId, open, onClose }: { cycleId: string; open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [durationMin, setDurationMin] = useState(90);
  const [notes, setNotes] = useState('');
  const schedule = useScheduleClass();
  const valid = Boolean(title.trim() && scheduledAt);

  async function submit() {
    if (!valid) return;
    await schedule.mutateAsync({
      cycleId,
      title: title.trim(),
      topic: topic.trim() || null,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMin,
      notes: notes.trim() || undefined,
    });
    setTitle('');
    setTopic('');
    setScheduledAt('');
    setDurationMin(90);
    setNotes('');
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Agendar aula"
      width={520}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => void submit().catch(() => {})} disabled={!valid || schedule.isPending}>
            {schedule.isPending ? 'Agendando…' : 'Agendar'}
          </button>
        </>
      }
    >
      <label className="btg-field">
        Título
        <input className="btg-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Aula 4 · DP intro" />
      </label>
      <label className="btg-field">
        Tópico (opcional)
        <input className="btg-input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="dp" />
      </label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <label className="btg-field">
          Quando
          <input type="datetime-local" className="btg-input" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
        </label>
        <label className="btg-field">
          Duração (min)
          <input type="number" min={15} step={15} className="btg-input btg-mono" value={durationMin} onChange={(e) => setDurationMin(Number(e.target.value))} />
        </label>
      </div>
      <label className="btg-field">
        Notas (opcional)
        <textarea className="btg-textarea" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      {schedule.error && <span className="btg-ac-danger" style={{ fontSize: 13 }}>{(schedule.error as Error).message}</span>}
    </Modal>
  );
}

function AttendanceModal({
  cycleId,
  session,
  members,
  onClose,
}: {
  cycleId: string;
  session: ClassSession | null;
  members: Member[];
  onClose: () => void;
}) {
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>({});
  const submit = useSubmitAttendance();

  // Everyone starts as PRESENT unless attendance was already taken.
  useEffect(() => {
    if (!session) return;
    setStatuses(
      Object.fromEntries(
        members.map((m) => [m.userId, session.attendances?.find((a) => a.userId === m.userId)?.status ?? 'PRESENT']),
      ),
    );
  }, [session, members]);

  async function save() {
    if (!session) return;
    await submit.mutateAsync({
      cycleId,
      classId: session.id,
      rows: members.map((m) => ({ userId: m.userId, status: statuses[m.userId] ?? 'PRESENT' })),
    });
    onClose();
  }

  return (
    <Modal
      open={session !== null}
      onClose={onClose}
      title={session ? `Presença · ${session.title}` : 'Presença'}
      width={600}
      footer={
        <>
          <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={onClose}>Cancelar</button>
          <button type="button" className="btg-btn btg-btn--primary btg-btn--sm" onClick={() => void save().catch(() => {})} disabled={submit.isPending}>
            {submit.isPending ? 'Salvando…' : 'Salvar presença'}
          </button>
        </>
      }
    >
      {session && <span className="btg-mono btg-mute" style={{ fontSize: 13 }}>{when(session.scheduledAt)} · {session.durationMin} min</span>}
      <div className="btg-ac-scroll" style={{ maxHeight: 420 }}>
        {members.map((m) => (
          <div key={m.userId} className="btg-ac-row" style={{ padding: '8px 12px' }}>
            <Avatar name={m.name} pictureUrl={m.pictureUrl} size="sm" />
            <span className="btg-ac-grow" style={{ fontSize: 14 }}><span>{m.name}</span></span>
            <span className="btg-ac-seg" role="group" aria-label={`Presença de ${m.name}`}>
              {STATUS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  aria-pressed={(statuses[m.userId] ?? 'PRESENT') === s.value}
                  onClick={() => setStatuses((prev) => ({ ...prev, [m.userId]: s.value }))}
                >
                  {s.label}
                </button>
              ))}
            </span>
          </div>
        ))}
      </div>
      {submit.error && <span className="btg-ac-danger" style={{ fontSize: 13 }}>{(submit.error as Error).message}</span>}
    </Modal>
  );
}

/** Classes card with scheduling and attendance. Mount in btg/admin/cycle.tsx. */
export function BtgClassesSection({ cycleId, members }: { cycleId: string; members: Member[] }) {
  const { data } = useCycleClasses(cycleId);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [attendanceFor, setAttendanceFor] = useState<ClassSession | null>(null);
  const sorted = [...(data ?? [])].sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt));
  const now = Date.now();

  return (
    <section className="btg-card">
      <div className="btg-card-head" style={{ padding: '14px 20px' }}>
        <span className="btg-card-title">
          <Icon name="school" style={{ color: 'var(--btg-secondary)' }} />
          Aulas · {sorted.length}
        </span>
        <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => setScheduleOpen(true)}>
          <Icon name="add" />
          Agendar
        </button>
      </div>
      {sorted.length === 0 && <p className="btg-empty">Nenhuma aula agendada ainda.</p>}
      {sorted.map((c) => {
        const past = new Date(c.scheduledAt).getTime() < now;
        const present = c.attendances?.filter((a) => a.status === 'PRESENT').length ?? 0;
        return (
          <div key={c.id} className="btg-ac-row" style={past ? { color: 'var(--btg-text-soft)' } : undefined}>
            <span className="btg-mono btg-mute" style={{ fontSize: 13, width: 112, flexShrink: 0 }}>{when(c.scheduledAt)}</span>
            <span className="btg-ac-grow">
              <span style={{ fontSize: 15 }}>{c.title}</span>
              <span className="btg-ac-meta">
                {c.topic ? `${c.topic} · ` : ''}
                <span className="btg-mono">{c.durationMin} min</span>
                {c.attendances && c.attendances.length > 0 && ` · ${present}/${c.attendances.length} presentes`}
              </span>
            </span>
            <button type="button" className="btg-btn btg-btn--ghost btg-btn--sm" onClick={() => setAttendanceFor(c)} aria-label={`Presença da aula ${c.title}`}>
              <Icon name="how_to_reg" />
              Presença
            </button>
          </div>
        );
      })}
      <ScheduleModal cycleId={cycleId} open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
      <AttendanceModal cycleId={cycleId} session={attendanceFor} members={members} onClose={() => setAttendanceFor(null)} />
    </section>
  );
}
