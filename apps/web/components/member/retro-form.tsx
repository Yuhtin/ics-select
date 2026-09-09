'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addToast } from '@heroui/react';
import type { RetroCurrentResponse, WeekRecapItem } from '../../lib/queries/me-retro';
import { useSubmitRetro } from '../../lib/queries/me-retro';
import { GuidedFlow } from './guided-flow';
import { GuidedChoice } from './guided-choice';
import { GuidedTextResponse } from './guided-text-response';
import { StudioPageHeader } from './studio-page-header';
import { RetroRecap } from './retro-recap';

interface RetroFormProps { data: RetroCurrentResponse }
const STUCK_OUTCOMES: ReadonlySet<WeekRecapItem['outcome']> = new Set(['DOUBTS', 'STUCK']);
const VALUED_OUTCOMES: ReadonlySet<WeekRecapItem['outcome']> = new Set(['DONE_EASY', 'DONE_HARD']);
type RetroStepId = 'stuck-item' | 'what-stuck' | 'valued-item' | 'what-clicked' | 'next-week';
const TITLES: Record<RetroStepId, string> = {
  'stuck-item': 'Qual item dessa semana travou ou ficou com dúvida?',
  'what-stuck': 'O que falta pra desbloquear?',
  'valued-item': 'Qual item dessa semana mais valeu a pena?',
  'what-clicked': 'Por quê?',
  'next-week': '1 coisa que você quer no próximo plano',
};
const DESCRIPTION = "Your notes help shape next week's plan. Only the program director sees them.";

export function RetroForm({ data }: RetroFormProps) {
  const recap = data.weekRecap ?? null;
  const [whatClicked, setWhatClicked]   = useState(data.retro?.whatClicked ?? '');
  const [whatStuck,   setWhatStuck]     = useState(data.retro?.whatStuck   ?? '');
  const [nextWeekWish, setNextWeekWish] = useState(data.retro?.nextWeekWish ?? '');
  const [valuedItemId, setValuedItemId] = useState<string | null>(data.retro?.valuedItemId ?? null);
  const [stuckItemId,  setStuckItemId]  = useState<string | null>(data.retro?.stuckItemId  ?? null);
  const submit = useSubmitRetro();

  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const stuckOptions = recap?.items.filter((item) => STUCK_OUTCOMES.has(item.outcome)) ?? [];
  const valuedOptions = recap?.items.filter((item) => VALUED_OUTCOMES.has(item.outcome)) ?? [];
  const showStuckQuestion = stuckOptions.length > 0;
  const showValuedQuestion = recap !== null;
  const steps = useMemo<RetroStepId[]>(() => {
    const visible: RetroStepId[] = [];
    if (showStuckQuestion) visible.push('stuck-item', 'what-stuck');
    if (showValuedQuestion) visible.push('valued-item', 'what-clicked');
    visible.push('next-week');
    return visible;
  }, [showStuckQuestion, showValuedQuestion]);
  const index = Math.min(stepIndex, steps.length - 1);
  useEffect(() => { setStepIndex((current) => Math.min(current, steps.length - 1)); }, [steps.length]);
  const activeStep = steps[index];
  const headingId = `retro-${activeStep}-question`;
  const final = index === steps.length - 1;
  const isUpdate = data.retro !== null;

  async function handleSubmit() {
    if (!final || !data.open || submit.isPending) return;
    try {
      await submit.mutateAsync({
        whatClicked: whatClicked.trim() || undefined,
        whatStuck:   whatStuck.trim()   || undefined,
        nextWeekWish: nextWeekWish.trim() || undefined,
        valuedItemId: valuedItemId,
        stuckItemId:  stuckItemId,
      });
      addToast({
        title: isUpdate ? 'Retro updated' : 'Retro saved',
        description: 'Your notes are with the program director.',
        color: 'success',
      });
    } catch (err) {
      addToast({
        title: 'Could not save retro',
        description: err instanceof Error ? err.message : 'Try again in a moment.',
        color: 'danger',
      });
    }
  }

  if (!data.open) {
    const answers = [
      { label: TITLES['stuck-item'], value: recap?.items.find((item) => item.id === data.retro?.stuckItemId)?.title },
      { label: TITLES['what-stuck'], value: data.retro?.whatStuck },
      { label: TITLES['valued-item'], value: recap?.items.find((item) => item.id === data.retro?.valuedItemId)?.title },
      { label: TITLES['what-clicked'], value: data.retro?.whatClicked },
      { label: TITLES['next-week'], value: data.retro?.nextWeekWish },
    ];
    return (
      <div className="max-w-4xl space-y-8">
        <StudioPageHeader eyebrow="Weekly retro" title="How was this week?" description={DESCRIPTION} />
        <p role="status" className="border-l-2 border-border-strong pl-4 text-sm leading-relaxed text-fg-soft">
          Retro closed — reopens Fri 18:00 local (window runs through Wed 23:59 of the next week).
        </p>
        {recap && <RetroRecap recap={recap} />}
        {data.retro && <dl className="divide-y divide-border-token">{answers.filter((answer) => answer.value).map((answer) => (
          <div key={answer.label} className="py-5">
            <dt className="text-sm text-fg-mute">{answer.label}</dt>
            <dd className="mt-2 whitespace-pre-wrap break-words text-lg leading-relaxed text-fg">{answer.value}</dd>
          </div>
        ))}</dl>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-border-token pb-5">
        <p className="font-mono text-[11px] uppercase tracking-label text-fg-mute">Weekly retro</p>
        <p className="text-sm text-fg-soft">How was this week?</p>
      </div>
      <GuidedFlow
        stepKey={activeStep} headingId={headingId} index={index} total={steps.length} direction={direction}
        title={TITLES[activeStep]} description={DESCRIPTION} canContinue final={final}
        submitLabel={isUpdate ? 'Update retro' : 'Submit retro'} submittingLabel="Saving…" submitting={submit.isPending}
        exitLabel="Exit reflection" onExit={() => router.push('/me')}
        onPrevious={() => { setDirection(-1); setStepIndex(Math.max(0, index - 1)); }}
        onContinue={() => { setDirection(1); setStepIndex(Math.min(steps.length - 1, index + 1)); }}
        onSubmit={handleSubmit}
        context={recap ? <RetroRecap recap={recap} presentation="context" /> : undefined}
      >
        {activeStep === 'stuck-item' && <GuidedChoice name="stuck-item" labelledBy={headingId}
          options={stuckOptions.map((item) => ({ value: item.id, label: item.title }))} value={stuckItemId} onChange={setStuckItemId} />}
        {activeStep === 'valued-item' && <GuidedChoice name="valued-item" labelledBy={headingId}
          options={[{ value: '__none__', label: 'Nenhum' }, ...valuedOptions.map((item) => ({ value: item.id, label: item.title }))]}
          value={valuedItemId ?? '__none__'} onChange={(value) => setValuedItemId(value === '__none__' ? null : value)} />}
        {activeStep === 'what-stuck' && <GuidedTextResponse id="retro-what-stuck" labelledBy={headingId} value={whatStuck} onChange={setWhatStuck} placeholder="O que ajudaria você a seguir?" />}
        {activeStep === 'what-clicked' && <GuidedTextResponse id="retro-what-clicked" labelledBy={headingId} value={whatClicked} onChange={setWhatClicked} placeholder="O que fez a diferença?" />}
        {activeStep === 'next-week' && <GuidedTextResponse id="retro-next-week" labelledBy={headingId} value={nextWeekWish} onChange={setNextWeekWish} placeholder="Menos LeetCode, mais system design…" />}
      </GuidedFlow>
    </div>
  );
}
