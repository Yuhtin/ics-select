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
  now: 'before:bg-primary',
  late: 'before:bg-warn',
  done: 'before:bg-success',
  neutral: 'before:bg-primary',
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
      className={clsx(
        'relative overflow-hidden rounded-tile border border-border-token bg-surface p-6 sm:p-8',
        // Left accent rail via ::before pseudo-element
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px]',
        HERO_BORDER[eyebrowStyle],
      )}
    >
      <div
        className={clsx(
          'flex items-center gap-2 font-sans text-xs font-medium',
          EYEBROW_TONE[eyebrowStyle],
        )}
      >
        {eyebrowStyle === 'now' && (
          <span
            className="inline-block h-[7px] w-[7px] rounded-full bg-primary"
            aria-hidden="true"
          />
        )}
        {eyebrow}
      </div>
      <h1 className="mt-3 max-w-[22ch] font-sans text-[30px] font-semibold leading-[1.15] tracking-tight sm:text-[36px] text-fg">
        {item.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-pill bg-bg-subtle px-2 font-medium text-fg-soft">
          {item.estimatedMinutes} min
        </span>
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-pill bg-bg-subtle px-2 font-medium text-fg-soft">
          <span
            className="h-[6px] w-[6px] rounded-full"
            style={{ background: `hsl(var(--platform-${platform}))` }}
          />
          {platformLabel(platform)}
        </span>
        {item.topic && (
          <span className="inline-flex h-[22px] items-center gap-1.5 rounded-pill bg-bg-subtle px-2 font-medium text-fg-soft">
            {item.topic.label}
          </span>
        )}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href={ctaHref}
          className={clsx(
            'inline-flex min-h-11 items-center justify-center rounded-input px-5 font-sans text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            'bg-primary text-primary-fg hover:bg-primary/90',
          )}
        >
          {ctaLabel}
        </Link>
      </div>
    </article>
  );
}

export function HeroScene({ hero }: HeroSceneProps) {
  if (!hero) {
    return (
      <article className="rounded-tile border border-border-token bg-surface p-6 sm:p-8">
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
      <article className="relative overflow-hidden rounded-tile border border-border-token bg-surface p-6 sm:p-8 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[2px] before:bg-success">
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
    <article className="rounded-tile border border-border-token bg-surface p-6 sm:p-8">
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
