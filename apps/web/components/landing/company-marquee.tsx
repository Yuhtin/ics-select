'use client';

import { COMPANIES } from './landing-data';

export function CompanyMarquee() {
  const items = [...COMPANIES, ...COMPANIES];

  return (
    <section className="py-8 bg-surface-muted border-y border-border/50 overflow-hidden">
      <div className="flex whitespace-nowrap" style={{ animation: 'marquee 30s linear infinite' }}>
        {items.map((company, i) => (
          <span
            key={`${company}-${i}`}
            className="text-h3 font-semibold text-foreground-subtle mx-8 flex-shrink-0"
          >
            {company}
          </span>
        ))}
      </div>
    </section>
  );
}
