'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Input, Textarea } from '@heroui/react';
import type { ItemOutcome } from '@ics-select/shared';
import { Button } from '../../../components/ui/button';
import { Pill } from '../../../components/ui/pill';
import { OutcomeDot } from '../../../components/ui/outcome-dot';
import { OutcomePicker } from '../../../components/ui/outcome-picker';
import { Card } from '../../../components/ui/card';
import { Eyebrow } from '../../../components/ui/eyebrow';
import { SectionLabel } from '../../../components/ui/section-label';
import { ListRow } from '../../../components/ui/list-row';
import { DayHeader } from '../../../components/ui/day-header';
import { StreakCard } from '../../../components/ui/streak-card';
import { BrandLockup } from '../../../components/shell/brand-lockup';
import { ThemeToggle } from '../../../components/ui/theme-toggle';
import { DataTable } from '../../../components/ui/data-table';
import { ProgressBar } from '../../../components/ui/progress-bar';
import { StatusChip, type StatusChipStatus } from '../../../components/ui/status-chip';

const swatches = [
  ['bg', 'bg-bg'],
  ['bg-subtle', 'bg-bg-subtle'],
  ['surface', 'bg-surface'],
  ['surface-strong', 'bg-surface-strong'],
  ['surface-hover', 'bg-surface-hover'],
  ['fg', 'bg-fg'],
  ['fg-soft', 'bg-fg-soft'],
  ['fg-mute', 'bg-fg-mute'],
  ['fg-faint', 'bg-fg-faint'],
  ['border', 'bg-border-token'],
  ['border-strong', 'bg-border-strong'],
  ['primary', 'bg-primary'],
  ['primary-soft', 'bg-primary-soft'],
  ['primary-fg', 'bg-primary-fg'],
] as const;

const statuses: StatusChipStatus[] = ['pending', 'in_progress', 'done_easy', 'done_hard', 'stuck'];

export default function DesignSystemPage() {
  const [outcome, setOutcome] = useState<ItemOutcome | null>('DONE_HARD');

  return (
    <main className="mx-auto max-w-5xl space-y-12 px-4 py-10 text-fg sm:px-6">
      <header>
        <div className="mb-8 flex items-center justify-between gap-4">
          <BrandLockup />
          <ThemeToggle />
        </div>
        <Eyebrow>Inteli Academy · Referência visual</Eyebrow>
        <h1 className="mt-3 font-sans text-3xl font-semibold tracking-tight sm:text-4xl">
          Academy Fellow design system
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-fg-soft">
          Tokens e componentes de produção em uma referência comum. Os dados abaixo são exemplos para verificação visual.
        </p>
      </header>

      <section>
        <SectionLabel>Marca e cores</SectionLabel>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {(['light', 'dark'] as const).map((theme) => (
            <div key={theme} data-theme={theme} className={`${theme} rounded-card border border-border-token bg-bg p-5 text-fg`}>
              <div className="mb-6 flex items-center justify-between gap-3">
                <BrandLockup size="sm" tone={theme === 'dark' ? 'inverse' : 'default'} />
                <span className="font-mono text-xs">{theme}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {swatches.map(([name, background]) => (
                  <div key={name}>
                    <div className={`h-12 rounded-input border border-border-token ${background}`} />
                    <p className="mt-2 font-mono text-[10px] text-fg-mute">{name}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-6 rounded-card bg-primary p-5 text-primary-fg">
          <BrandLockup size="lg" tone="inverse" />
          <BrandLockup size="sm" tone="inverse" showWordmark={false} />
        </div>
      </section>

      <section>
        <SectionLabel>Typography</SectionLabel>
        <Card className="p-6 space-y-4">
          <p className="font-serif text-[40px] font-medium leading-[1.1] tracking-tight">
            Newsreader · momentos editoriais.
          </p>
          <p className="font-sans text-base text-fg-soft">
            Inter · interfaces, rótulos e parágrafos.
          </p>
          <p className="font-mono text-xs text-fg-mute tabular-nums">
            JetBrains Mono · 13:00 · 1.234 · IDs e contagens
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel>Fields</SectionLabel>
        <Card className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2">
          <Input
            label="Nome"
            labelPlacement="outside"
            placeholder="Seu nome"
            variant="bordered"
            classNames={{ inputWrapper: 'rounded-input border-border-token bg-surface', input: 'text-fg' }}
          />
          <Input
            label="Email"
            labelPlacement="outside"
            type="email"
            defaultValue="email inválido"
            isInvalid
            errorMessage="Informe um email válido."
            variant="bordered"
            classNames={{ inputWrapper: 'rounded-input' }}
          />
          <Textarea
            label="Reflexão"
            labelPlacement="outside"
            placeholder="O que você aprendeu hoje?"
            variant="bordered"
            classNames={{ inputWrapper: 'rounded-input border-border-token bg-surface', input: 'text-fg' }}
          />
          <Input label="Turma" defaultValue="Exemplo de campo desabilitado" isDisabled variant="bordered" />
        </Card>
      </section>

      <section>
        <SectionLabel>Status</SectionLabel>
        <Card className="flex flex-wrap gap-3 p-6">
          {statuses.map((status) => <StatusChip key={status} status={status} />)}
        </Card>
      </section>

      <section>
        <SectionLabel>Buttons</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-3 items-center">
          <Button variant="primary" size="sm">Small primary</Button>
          <Button variant="primary">Primary</Button>
          <Button variant="primary" size="lg">Large primary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link button</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Card>
      </section>

      <section>
        <SectionLabel>Pills</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-2">
          <Pill>LEETCODE</Pill>
          <Pill variant="soft">DP</Pill>
          <Pill variant="outline">45 min</Pill>
        </Card>
      </section>

      <section>
        <SectionLabel>Outcome dots</SectionLabel>
        <Card className="p-6 flex flex-wrap gap-4 items-center text-sm">
          {(['PENDING', 'DONE_EASY', 'DONE_HARD', 'DOUBTS', 'STUCK', 'SKIPPED'] as ItemOutcome[]).map((o) => (
            <span key={o} className="inline-flex items-center gap-2">
              <OutcomeDot outcome={o} />
              <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                {o}
              </span>
            </span>
          ))}
          <span className="inline-flex items-center gap-2 ml-6">
            <OutcomeDot outcome="PENDING" active />
            <span className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              PENDING · active
            </span>
          </span>
        </Card>
      </section>

      <section>
        <SectionLabel>Progress</SectionLabel>
        <Card className="space-y-6 p-6">
          <ProgressBar value={0.6} tone="primary" label="Plano da semana · exemplo" valueLabel="60%" />
          <ProgressBar value={1} tone="success" label="Concluído · exemplo" valueLabel="100%" />
          <ProgressBar value={0} label="Ainda não iniciado · exemplo" valueLabel="0%" />
        </Card>
      </section>

      <section>
        <SectionLabel>Tables</SectionLabel>
        <DataTable toolbar={<span className="text-sm font-semibold">Atividades · dados de exemplo</span>}>
          <table className="w-full text-left text-sm">
            <thead className="bg-bg-subtle text-fg-mute">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">Atividade</th>
                <th scope="col" className="px-6 py-3 font-medium">Tempo</th>
                <th scope="col" className="px-6 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-token">
              <tr>
                <td className="px-6 py-4">Recursion intro</td>
                <td className="px-6 py-4 font-mono text-xs">30 min</td>
                <td className="px-6 py-4"><StatusChip status="done_easy" /></td>
              </tr>
              <tr>
                <td className="px-6 py-4">Binary search patterns</td>
                <td className="px-6 py-4 font-mono text-xs">45 min</td>
                <td className="px-6 py-4"><StatusChip status="pending" /></td>
              </tr>
            </tbody>
          </table>
        </DataTable>
      </section>

      <section>
        <SectionLabel>Outcome picker</SectionLabel>
        <Card className="p-6 space-y-3">
          <OutcomePicker value={outcome} onChange={setOutcome} />
          <p className="font-mono text-[11px] text-ink-mute">
            current: <span className="text-ink">{outcome ?? 'null'}</span>
          </p>
        </Card>
      </section>

      <section>
        <SectionLabel>List rows (Today)</SectionLabel>
        <Card className="px-6">
          <DayHeader label="Today" hint="3 items · 110 min" />
          <ListRow
            time="13:00"
            outcome="DONE_EASY"
            title="Recursion intro"
            meta="VIDEO · 30 MIN"
          />
          <ListRow
            time="19:00"
            outcome="PENDING"
            active
            title="Binary search patterns"
            meta="LEETCODE · 45 MIN · NOW"
          />
          <ListRow
            time="21:00"
            outcome="PENDING"
            title="Complexity review"
            meta="ARTICLE · 20 MIN"
          />
        </Card>
      </section>

      <section>
        <SectionLabel>Streak card</SectionLabel>
        <div className="max-w-xs">
          <StreakCard current={12} last7={[true, true, true, false, true, true, true]} />
        </div>
      </section>
      <section>
        <SectionLabel>Composição editorial</SectionLabel>
        <Card className="overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col justify-between gap-8 p-6 sm:p-8">
              <div>
                <Eyebrow>Inteli Academy</Eyebrow>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                  Academy <span className="font-serif font-medium">Fellow</span>
                </h2>
                <p className="mt-4 max-w-sm text-sm leading-relaxed text-fg-soft">
                  Preparação para tech de elite. Uma comunidade para aprender, praticar e evoluir.
                </p>
              </div>
              <BrandLockup size="sm" />
            </div>
            <Image
              src="/brand/academy/academy-community.webp"
              alt="Comunidade Inteli Academy reunida em uma escadaria"
              width={1280}
              height={960}
              sizes="(min-width: 768px) 450px, 100vw"
              className="aspect-[4/3] w-full object-cover"
            />
          </div>
        </Card>
        <div className="mt-4 flex items-center gap-6 rounded-card bg-primary-soft p-6">
          <Image
            src="/brand/academy/academy-robot.webp"
            alt=""
            width={160}
            height={160}
            sizes="160px"
            className="h-24 w-24 shrink-0 object-contain sm:h-40 sm:w-40"
          />
          <p className="font-serif text-2xl leading-tight">Academy, em cada detalhe.</p>
        </div>
      </section>
    </main>
  );
}
