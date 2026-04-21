'use client';

import { Download } from 'lucide-react';

export function WaitlistExportButton() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return (
    <a
      href={`${base}/admin/waitlist/export`}
      className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-3 py-2 rounded-full border border-rule bg-surface text-ink-soft hover:border-ink hover:text-ink transition-colors"
    >
      <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
      Export CSV
    </a>
  );
}
