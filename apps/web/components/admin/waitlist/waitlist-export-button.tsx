'use client';

import { Download } from 'lucide-react';

export function WaitlistExportButton() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return (
    <a
      href={`${base}/admin/waitlist/export`}
      className="inline-flex items-center gap-2 font-sans text-xs font-medium px-3 py-2 rounded-full border border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg transition-colors"
    >
      <Download className="w-3.5 h-3.5" strokeWidth={1.5} />
      Export CSV
    </a>
  );
}
