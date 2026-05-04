'use client';
import { clsx } from 'clsx';
import type { MemberRank } from '../../lib/queries/me-cohort';
import { SectionLabel } from '../ui/section-label';

interface CohortSpotlightProps {
  ranking: MemberRank[];
  className?: string;
}

function dotsForIntensity(intensity: number): { filled: number; empty: number } {
  if (intensity >= 0.66) return { filled: 3, empty: 0 };
  if (intensity >= 0.33) return { filled: 2, empty: 1 };
  return { filled: 1, empty: 2 };
}

function Dots({ filled, empty }: { filled: number; empty: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {Array.from({ length: filled }).map((_, i) => (
        <span key={`f-${i}`} className="text-focus">●</span>
      ))}
      {Array.from({ length: empty }).map((_, i) => (
        <span key={`e-${i}`} className="text-rule">○</span>
      ))}
    </div>
  );
}

export function CohortSpotlight({ ranking, className }: CohortSpotlightProps) {
  if (ranking.length === 0) return null;

  const top1Score = ranking[0]!.score;

  return (
    <div className={clsx('space-y-4', className)}>
      <SectionLabel>On fire</SectionLabel>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ranking.map((entry, idx) => {
          const intensity = idx === 0 ? 1 : top1Score > 0 ? entry.score / top1Score : 0;
          const dots = dotsForIntensity(intensity);
          return (
            <div
              key={entry.userId}
              className={clsx(
                'flex flex-col items-center gap-3 rounded-card border p-4',
                entry.isMe ? 'border-ink' : 'border-rule',
              )}
            >
              <div className="h-12 w-12 overflow-hidden rounded-full bg-paper-warm">
                {entry.pictureUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.pictureUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <p className="font-serif text-base font-medium text-ink">
                {entry.name}
                {entry.isMe && <span className="ml-1 text-ink-mute">(you)</span>}
              </p>
              <Dots filled={dots.filled} empty={dots.empty} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
