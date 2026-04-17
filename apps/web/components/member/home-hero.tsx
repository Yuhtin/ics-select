'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import type { HomeResponse, HomeItem } from '../../lib/queries/me-home';
import { Eyebrow } from '../ui/eyebrow';
import { Pill } from '../ui/pill';
import { Button } from '../ui/button';
import { OutcomeDot } from '../ui/outcome-dot';
import { formatTimeUtc, formatRelative, formatDateShort } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface HomeHeroProps {
  hero: HomeResponse['hero'];
}

type Accent = 'neutral' | 'now' | 'late' | 'done';

const EYEBROW_CLASS: Record<Accent, string> = {
  neutral: '',
  now: '!text-focus',
  late: '!text-outcome-stuck',
  done: '!text-outcome-done-easy',
};

const BORDER_CLASS: Record<Accent, string> = {
  neutral: '',
  now: 'border-l-4 border-focus pl-5 md:pl-6',
  late: 'border-l-4 border-outcome-stuck pl-5 md:pl-6',
  done: '',
};

function HeroItemLayout({
  accent,
  eyebrow,
  item,
  ctaHref,
  ctaLabel,
}: {
  accent: Accent;
  eyebrow: string;
  item: HomeItem;
  ctaHref: string;
  ctaLabel: string;
}) {
  const platform = detectPlatform(item.url, item.format);
  return (
    <section className={clsx('max-w-3xl', BORDER_CLASS[accent])}>
      <Eyebrow className={EYEBROW_CLASS[accent]}>{eyebrow}</Eyebrow>
      <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-tight">
        {item.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill>{platformLabel(platform)}</Pill>
        <span className="font-mono text-xs text-ink-mute">{item.estimatedMinutes} MIN</span>
        {item.topic && <Pill variant="soft">{item.topic.label}</Pill>}
      </div>
      <div className="mt-6 flex gap-2">
        <Link href={ctaHref}>
          <Button
            variant="primary"
            className={clsx(accent === 'now' && 'bg-focus hover:bg-focus/90')}
          >
            {ctaLabel}
          </Button>
        </Link>
      </div>
    </section>
  );
}

export function HomeHero({ hero }: HomeHeroProps) {
  if (!hero) {
    return (
      <section className="max-w-3xl">
        <Eyebrow>No active plan</Eyebrow>
        <h1 className="mt-3 font-serif text-[36px] font-medium leading-tight tracking-tight">
          Waiting for the next plan.
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          The program director hasn&apos;t published your plan yet.
        </p>
      </section>
    );
  }

  if (hero.state === 'now') {
    return (
      <HeroItemLayout
        accent="now"
        eyebrow={`Now · ${formatTimeUtc(hero.item.scheduledAt) ?? ''}`}
        item={hero.item}
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Start study"
      />
    );
  }
  if (hero.state === 'up_next') {
    return (
      <HeroItemLayout
        accent="neutral"
        eyebrow={`Up next · ${formatRelative(hero.minutesUntil)}`}
        item={hero.item}
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Open"
      />
    );
  }
  if (hero.state === 'running_late') {
    return (
      <HeroItemLayout
        accent="late"
        eyebrow={`Running late · was at ${formatTimeUtc(hero.item.scheduledAt) ?? ''}`}
        item={hero.item}
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Catch up"
      />
    );
  }
  if (hero.state === 'all_done') {
    return (
      <section className="max-w-3xl">
        <div className="flex items-center gap-2">
          <OutcomeDot outcome="DONE_EASY" size="sm" />
          <Eyebrow className="!text-outcome-done-easy">All done today</Eyebrow>
        </div>
        <h1 className="mt-3 font-serif text-[36px] font-medium leading-tight tracking-tight">
          Nothing more scheduled today.
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          {hero.nextAt ? `Next up: ${formatDateShort(hero.nextAt)} at ${formatTimeUtc(hero.nextAt)}.` : 'See you soon.'}
        </p>
      </section>
    );
  }
  // free_day
  return (
    <section className="max-w-3xl">
      <Eyebrow>Free day</Eyebrow>
      <h1 className="mt-3 font-serif text-[36px] font-medium leading-tight tracking-tight">
        No study scheduled today.
      </h1>
      <p className="mt-3 font-sans text-sm text-ink-soft">
        {hero.nextAt ? `Next up: ${formatDateShort(hero.nextAt)} at ${formatTimeUtc(hero.nextAt)}.` : 'Rest up.'}
      </p>
    </section>
  );
}
