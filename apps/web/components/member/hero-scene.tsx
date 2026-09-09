'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import type { HomeResponse, HomeItem } from '../../lib/queries/me-home';
import { formatTimeLocal, formatRelative, formatDateLocal } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface HeroSceneProps {
  hero: HomeResponse['hero'];
}

type HeroStyle = 'now' | 'late' | 'done' | 'neutral';

const HERO_BORDER: Record<HeroStyle, string> = {
  now: 'border-l-primary',
  late: 'border-l-warn',
  done: 'border-l-success',
  neutral: 'border-l-primary',
};

const EYEBROW_TONE: Record<HeroStyle, string> = {
  now: 'text-primary dark:text-primary-fg',
  late: 'text-fg',
  done: 'text-fg',
  neutral: 'text-primary dark:text-primary-fg',
};

function ItemHero({
  item,
  eyebrow,
  eyebrowStyle,
  ctaHref,
  ctaLabel,
}: {
  item: HomeItem;
  eyebrow: string;
  eyebrowStyle: HeroStyle;
  ctaHref: string;
  ctaLabel: string;
}) {
  const platform = detectPlatform(item.url, item.format);
  return (
    <article
      data-testid="current-focus"
      className={clsx(
        'grid gap-5 border-b border-l-4 border-border-token pb-6 pl-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end',
        HERO_BORDER[eyebrowStyle],
      )}
    >
      <div>
        <p className={clsx('font-sans text-xs font-semibold', EYEBROW_TONE[eyebrowStyle])}>{eyebrow}</p>
        <h1 className="mt-3 max-w-[24ch] text-[30px] font-semibold leading-[1.12] tracking-[-0.045em] text-fg sm:text-[38px]">{item.title}</h1>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 font-sans text-xs text-fg-mute">
          <span>{item.estimatedMinutes} min</span>
          <span>{platformLabel(platform)}</span>
          {item.topic && <span>{item.topic.label}</span>}
        </p>
      </div>
      <Link
        href={ctaHref}
        className="inline-flex min-h-11 items-center justify-center rounded-input bg-primary px-5 font-sans text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        {ctaLabel}
      </Link>
    </article>
  );
}

export function HeroScene({ hero }: HeroSceneProps) {
  if (!hero) {
    return (
      <article data-testid="current-focus" className="border-b border-l-4 border-border-token pb-6 pl-5">
        <p className="font-sans text-xs font-medium text-fg-mute">
          No active plan
        </p>
        <h1 className="mt-3 max-w-[22ch] font-sans text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[32px] text-fg">
          Waiting for the next plan.
        </h1>
        <p className="mt-3 font-sans text-sm text-fg-soft">
          The program director hasn&apos;t published your plan yet.
        </p>
      </article>
    );
  }

  if (hero.state === 'now') {
    return (
      <ItemHero
        item={hero.item}
        eyebrow={`Now · scheduled ${formatTimeLocal(hero.item.scheduledAt) ?? ''} · ${platformLabel(detectPlatform(hero.item.url, hero.item.format))}`}
        eyebrowStyle="now"
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Start study"
      />
    );
  }
  if (hero.state === 'up_next') {
    return (
      <ItemHero
        item={hero.item}
        eyebrow={`Up next · ${formatRelative(hero.minutesUntil)}`}
        eyebrowStyle="neutral"
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Open"
      />
    );
  }
  if (hero.state === 'running_late') {
    return (
      <ItemHero
        item={hero.item}
        eyebrow={`Running late · was at ${formatTimeLocal(hero.item.scheduledAt) ?? ''}`}
        eyebrowStyle="late"
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Catch up"
      />
    );
  }
  if (hero.state === 'all_done') {
    return (
      <article data-testid="current-focus" className="border-b border-l-4 border-border-token border-l-success pb-6 pl-5">
        <p className="flex items-center gap-2 font-sans text-xs font-medium text-fg">
          <span className="h-[6px] w-[6px] rounded-full bg-success" />
          All done today
        </p>
        <h1 className="mt-3 max-w-[22ch] font-sans text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[32px] text-fg">
          Nothing more scheduled today.
        </h1>
        <p className="mt-3 font-sans text-sm text-fg-soft">
          {hero.nextAt
            ? `Next up: ${formatDateLocal(hero.nextAt)} at ${formatTimeLocal(hero.nextAt)}.`
            : 'See you soon.'}
        </p>
      </article>
    );
  }
  // free_day
  return (
    <article data-testid="current-focus" className="border-b border-l-4 border-border-token pb-6 pl-5">
      <p className="font-sans text-xs font-medium text-fg-mute">
        Free day
      </p>
      <h1 className="mt-3 max-w-[22ch] font-sans text-[28px] font-semibold leading-[1.15] tracking-tight sm:text-[32px] text-fg">
        No study scheduled today.
      </h1>
      <p className="mt-3 font-sans text-sm text-fg-soft">
        {hero.nextAt
          ? `Next up: ${formatDateLocal(hero.nextAt)} at ${formatTimeLocal(hero.nextAt)}.`
          : 'Rest up.'}
      </p>
    </article>
  );
}
