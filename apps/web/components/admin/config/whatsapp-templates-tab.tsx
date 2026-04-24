'use client';
import { useEffect, useState } from 'react';
import { addToast } from '@heroui/react';
import { Save } from 'lucide-react';
import {
  useWhatsappTemplates,
  useUpdateWhatsappTemplate,
  type WhatsappTemplate,
} from '../../../lib/queries/admin-whatsapp-templates';
import { SectionLabel } from '../../ui/section-label';

const KIND_LABELS: Record<string, { title: string; subtitle: string }> = {
  session_reminder: {
    title: 'Session reminder',
    subtitle: '~10 min antes de cada bloco no Google Calendar do membro.',
  },
  plan_published: {
    title: 'Plan published',
    subtitle: 'Quando o plano da semana fica disponível pro membro.',
  },
  retro_reminder: {
    title: 'Retro reminder',
    subtitle: 'Sexta às 18h no TZ do membro, lembrando de submeter o retrô.',
  },
  stuck_alert: {
    title: 'Stuck alert',
    subtitle: 'Quando o admin escolhe avisar o membro que ficou stuck. (não wired)',
  },
  test: {
    title: 'Test',
    subtitle: 'Mensagem usada pelo botão de teste em /admin.',
  },
};

export function WhatsappTemplatesTab() {
  const { data, isLoading } = useWhatsappTemplates();

  if (isLoading) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute py-12 text-center">
        Loading…
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="font-sans text-sm text-ink-soft">
        Edite as mensagens enviadas via WhatsApp. Use{' '}
        <code className="font-mono text-[11px] bg-paper-warm px-1 py-0.5 rounded">{'{firstName}'}</code>{' '}
        e outras variáveis listadas em cada card. Desabilitar pula o envio sem deletar a mensagem.
      </p>
      {(data ?? []).map((tpl) => (
        <TemplateCard key={tpl.kind} template={tpl} />
      ))}
    </div>
  );
}

function TemplateCard({ template }: { template: WhatsappTemplate }) {
  const update = useUpdateWhatsappTemplate();
  const [text, setText] = useState(template.template);
  const [enabled, setEnabled] = useState(template.enabled);
  const [dirty, setDirty] = useState(false);

  // Re-sync local state when the server returns a fresh row (after save or
  // when navigating between tabs).
  useEffect(() => {
    setText(template.template);
    setEnabled(template.enabled);
    setDirty(false);
  }, [template.template, template.enabled]);

  const meta = KIND_LABELS[template.kind] ?? {
    title: template.kind,
    subtitle: template.description ?? '',
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({ kind: template.kind, template: text, enabled });
      addToast({ title: 'Template updated', color: 'success' });
      setDirty(false);
    } catch (err) {
      addToast({
        title: 'Update failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        color: 'danger',
      });
    }
  };

  return (
    <article className="rounded-card border border-rule bg-surface p-5 space-y-3">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-serif-tool text-lg font-semibold text-ink">
            {meta.title}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] uppercase tracking-label text-ink-mute">
            {template.kind}
          </p>
          <p className="mt-1 font-sans text-sm text-ink-soft">{meta.subtitle}</p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setDirty(true);
            }}
            className="accent-ink"
          />
          <span className="font-mono text-[11px] uppercase tracking-label text-ink-soft">
            Enabled
          </span>
        </label>
      </header>

      <div>
        <SectionLabel>Variáveis disponíveis</SectionLabel>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {template.variables.length === 0 ? (
            <span className="font-mono text-[10px] text-ink-mute">— sem variáveis</span>
          ) : (
            template.variables.map((v) => (
              <code
                key={v}
                className="font-mono text-[10px] bg-paper-warm border border-rule px-1.5 py-0.5 rounded text-ink-soft"
              >
                {`{${v}}`}
              </code>
            ))
          )}
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        rows={3}
        className="w-full rounded-input border border-rule bg-paper p-3 font-sans text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-focus/40"
      />

      <footer className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] text-ink-mute">
          {template.updatedAt
            ? `last edit · ${new Date(template.updatedAt).toLocaleString('pt-BR')}`
            : 'never edited (using default)'}
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || update.isPending || text.trim().length === 0}
          className="inline-flex items-center gap-2 bg-ink text-paper rounded-pill px-4 py-2 font-mono text-xs uppercase tracking-label hover:opacity-90 disabled:opacity-40"
        >
          <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
          {update.isPending ? 'Saving…' : 'Save'}
        </button>
      </footer>
    </article>
  );
}
