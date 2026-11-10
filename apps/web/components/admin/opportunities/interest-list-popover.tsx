'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import type { OpportunityDto } from '../../../lib/queries/opportunities';
import { shortDate } from '../../opportunities/opportunity-card';

export function InterestListPopover({ interests }: { interests: OpportunityDto['interests'] }) {
  if (interests.length === 0) return <span className="text-fg-mute">0</span>;
  return (
    <Popover placement="bottom-start">
      <PopoverTrigger>
        <button
          type="button"
          aria-label={`${interests.length} interested`}
          className="rounded-pill border border-border-token px-2.5 py-1 text-xs tabular-nums text-fg hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {interests.length}
        </button>
      </PopoverTrigger>
      <PopoverContent className="rounded-card border border-border-token bg-surface p-3 shadow-none">
        <ul className="space-y-2 font-sans text-xs">
          {interests.map((i) => (
            <li key={i.userId} className="flex items-center gap-2">
              <span className="inline-grid h-6 w-6 place-items-center overflow-hidden rounded-full bg-bg-subtle text-[10px] font-semibold text-fg-soft">
                {i.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={i.pictureUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  i.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <span className="text-fg">{i.name}</span>
              <span className="ml-auto pl-4 tabular-nums text-fg-mute">{shortDate(i.createdAt.slice(0, 10))}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
