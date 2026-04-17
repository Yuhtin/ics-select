'use client';

import Link from 'next/link';
import { clsx } from 'clsx';
import type { HomeResponse, HomeItem } from '../../lib/queries/me-home';
import { formatTimeUtc, formatRelative, formatDateShort } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface HeroSceneProps {
  hero: HomeResponse['hero'];
}

type HeroStyle = 'now' | 'late' | 'done' | 'neutral';

const HERO_BORDER: Record<HeroStyle, string> = {
  now: 'before:bg-primary',
  late: 'before:bg-warn',
  done: 'before:bg-success',
  neutral: 'before:bg-transparent',
};

const EYEBROW_TONE: Record<HeroStyle, string> = {
  now: 'text-primary',
  late: 'text-warn',
  done: 'text-success',
  neutral: 'text-fg-mute',
};

function ItemHero({
  item,
  eyebrow,
  eyebrowStyle,
  ctaHref,
  ctaLabel,
  ctaAccent = true,
}: {
  item: HomeItem;
  eyebrow: string;
  eyebrowStyle: HeroStyle;
  ctaHref: string;
  ctaLabel: string;
  ctaAccent?: boolean;
}) {
  const platform = detectPlatform(item.url, item.format);
  return (
    <article
      className={clsx(
        'relative overflow-hidden rounded-tile border border-border-token bg-surface p-7 shadow-sm',
        // Left accent rail via ::before pseudo-element
        'before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px]',
        HERO_BORDER[eyebrowStyle],
      )}
    >
      <div
        className={clsx(
          'flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-eyebrow',
          EYEBROW_TONE[eyebrowStyle],
        )}
      >
        {eyebrowStyle === 'now' && (
          <span
            className="inline-block h-[7px] w-[7px] rounded-full bg-primary animate-pulse-ring"
            aria-hidden="true"
          />
        )}
        {eyebrow}
      </div>
      <h1 className="mt-3 max-w-[22ch] font-serif text-[36px] font-medium leading-[1.1] tracking-tight text-fg">
        {item.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px]">
        <span className="inline-flex h-[22px] items-center gap-1.5 rounded-pill bg-bg-subtle px-2 font-medium text-fg-soft">
          <span className="h-[6px] w-[6px] rounded-full bg-fg-soft" />
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
            'inline-flex h-10 items-center justify-center rounded-[10px] px-4 font-sans text-sm font-medium transition-colors',
            ctaAccent
              ? 'bg-primary text-primary-fg shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] hover:bg-primary/90'
              : 'bg-fg text-bg hover:bg-fg-soft',
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
      <article className="rounded-tile border border-border-token bg-surface p-7">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
          No active plan
        </p>
        <h1 className="mt-3 max-w-[22ch] font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-fg">
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
        eyebrow={`Now · scheduled ${formatTimeUtc(hero.item.scheduledAt) ?? ''} · ${platformLabel(detectPlatform(hero.item.url, hero.item.format))}`}
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
        ctaAccent={false}
      />
    );
  }
  if (hero.state === 'running_late') {
    return (
      <ItemHero
        item={hero.item}
        eyebrow={`Running late · was at ${formatTimeUtc(hero.item.scheduledAt) ?? ''}`}
        eyebrowStyle="late"
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Catch up"
      />
    );
  }
  if (hero.state === 'all_done') {
    return (
      <article className="relative overflow-hidden rounded-tile border border-border-token bg-surface p-7 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:bg-success">
        <p className="flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-success">
          <span className="h-[6px] w-[6px] rounded-full bg-success" />
          All done today
        </p>
        <h1 className="mt-3 max-w-[22ch] font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-fg">
          Nothing more scheduled today.
        </h1>
        <p className="mt-3 font-sans text-sm text-fg-soft">
          {hero.nextAt
            ? `Next up: ${formatDateShort(hero.nextAt)} at ${formatTimeUtc(hero.nextAt)}.`
            : 'See you soon.'}
        </p>
      </article>
    );
  }
  // free_day
  return (
    <article className="rounded-tile border border-border-token bg-surface p-7">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        Free day
      </p>
      <h1 className="mt-3 max-w-[22ch] font-serif text-[32px] font-medium leading-[1.1] tracking-tight text-fg">
        No study scheduled today.
      </h1>
      <p className="mt-3 font-sans text-sm text-fg-soft">
        {hero.nextAt
          ? `Next up: ${formatDateShort(hero.nextAt)} at ${formatTimeUtc(hero.nextAt)}.`
          : 'Rest up.'}
      </p>
    </article>
  );
}
