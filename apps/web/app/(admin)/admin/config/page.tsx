'use client';
import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { WhatsappTemplatesTab } from '../../../../components/admin/config/whatsapp-templates-tab';

type TabKey = 'whatsapp';

const TABS: { key: TabKey; label: string; icon: typeof MessageSquare }[] = [
  { key: 'whatsapp', label: 'WhatsApp messages', icon: MessageSquare },
];

export default function AdminConfigPage() {
  const [tab, setTab] = useState<TabKey>('whatsapp');
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <header>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Config</h1>
      </header>

      <nav className="flex gap-1 border-b border-rule">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={
                'inline-flex items-center gap-2 px-4 py-2 font-mono text-xs uppercase tracking-label border-b-2 -mb-px transition-colors ' +
                (active
                  ? 'border-ink text-ink'
                  : 'border-transparent text-ink-mute hover:text-ink')
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              {label}
            </button>
          );
        })}
      </nav>

      {tab === 'whatsapp' && <WhatsappTemplatesTab />}
    </div>
  );
}
