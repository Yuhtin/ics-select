'use client';
import { use, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react';
import { useAdminMember } from '../../../../../lib/queries/admin-member';
import { TopicCoverageMini } from '../../../../../components/admin/plan-editor/topic-coverage-mini';
import { TimelineTab } from '../../../../../components/admin/member-detail/timeline-tab';
import { RetrosTab } from '../../../../../components/admin/member-detail/retros-tab';
import { DiagnoseTab } from '../../../../../components/admin/member-detail/diagnose-tab';
import { NotesTab } from '../../../../../components/admin/member-detail/notes-tab';
import { Eyebrow } from '../../../../../components/ui/eyebrow';
import { clsx } from 'clsx';

type Tab = 'timeline' | 'retros' | 'diagnose' | 'notes';

const TRACK_LABEL: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

function Initials({ name, pictureUrl, size = 48 }: { name: string; pictureUrl: string | null; size?: number }) {
  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={pictureUrl} alt="" className="rounded-full object-cover border border-rule" style={{ width: size, height: size }} />;
  }
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-paper-warm border border-rule font-serif text-ink text-lg font-semibold" style={{ width: size, height: size }}>
      {initials || '—'}
    </span>
  );
}

export default function AdminMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: memberId } = use(params);
  const { data, isLoading, error } = useAdminMember(memberId);
  const [tab, setTab] = useState<Tab>('timeline');

  if (isLoading) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  if (error || !data) {
    return (
      <div className="max-w-xl space-y-4">
        <Link href="/admin" className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-mute hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
        </Link>
        <p className="font-sans text-sm text-outcome-stuck">Failed to load member. {error instanceof Error ? error.message : ''}</p>
      </div>
    );
  }

  const { member, cycle, topicCoverage } = data;
  const waLink = member.whatsappPhone ? `https://wa.me/${member.whatsappPhone.replace(/[^0-9]/g, '')}` : null;

  return (
    <div className="max-w-5xl space-y-10">
      <div>
        <Link href="/admin" className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-mute hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} /> Back
        </Link>
      </div>

      <header className="flex flex-wrap items-start gap-6">
        <Initials name={member.name} pictureUrl={member.pictureUrl} />
        <div className="flex-1 min-w-0">
          <Eyebrow>Member · {member.role}</Eyebrow>
          <h1 className="mt-1 font-serif-tool text-3xl font-semibold tracking-tight text-ink">{member.name}</h1>
          <p className="mt-1 font-mono text-xs text-ink-mute">
            {member.track ? TRACK_LABEL[member.track] ?? member.track : 'No track'}
            {cycle && (<> · {cycle.name} · week {cycle.weekNumber} of {cycle.weeksTotal}</>)}
            {' · '}{member.email}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href={`/admin/member/${memberId}/plan/new`}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            Create plan for next week
          </Link>
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-paper-warm text-ink-soft rounded-pill hover:bg-rule"
            >
              <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
              WhatsApp ↗
            </a>
          ) : (
            <button disabled className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-faint rounded-pill opacity-40 cursor-not-allowed">
              WhatsApp
            </button>
          )}
          <button
            onClick={() => alert('Export coming in a future iteration')}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Export data
          </button>
        </div>
      </header>

      <section>
        <Eyebrow>Topic coverage · this cycle</Eyebrow>
        <div className="mt-3">
          <TopicCoverageMini topics={topicCoverage} />
        </div>
      </section>

      <nav className="border-b border-rule flex gap-6">
        {(['timeline', 'retros', 'diagnose', 'notes'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              'pb-3 font-mono text-xs uppercase tracking-label transition-colors',
              tab === t ? 'text-ink font-semibold border-b-2 border-ink -mb-[1px]' : 'text-ink-mute hover:text-ink',
            )}
          >
            {t}
          </button>
        ))}
      </nav>

      <div>
        {tab === 'timeline' && (
          <TimelineTab memberId={memberId} plans={data.timeline} />
        )}
        {tab === 'retros' && <RetrosTab retros={data.retros} />}
        {tab === 'diagnose' && <DiagnoseTab memberId={memberId} />}
        {tab === 'notes' && <NotesTab memberId={memberId} />}
      </div>
    </div>
  );
}
