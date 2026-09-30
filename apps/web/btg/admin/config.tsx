'use client';

import { useEffect, useState } from 'react';
import {
  useUpdateWhatsappTemplate,
  useWhatsappTemplates,
  type WhatsappTemplate,
} from '../../lib/queries/admin-whatsapp-templates';
import { Icon, Loading } from '../ui';

const KIND: Record<string, { title: string; subtitle: string }> = {
  session_reminder: { title: 'Lembrete de sessão', subtitle: 'Cerca de 10 min antes de cada bloco no Google Agenda do membro.' },
  plan_published: { title: 'Plano publicado', subtitle: 'Quando o plano da semana fica disponível para o membro.' },
  retro_reminder: { title: 'Lembrete da retro', subtitle: 'Sexta às 18h no fuso do membro, lembrando de enviar a retro.' },
  stuck_alert: { title: 'Alerta de travamento', subtitle: 'Quando você decide avisar o membro que travou. (Ainda não conectado.)' },
  test: { title: 'Mensagem de teste', subtitle: 'Usada pelo botão de teste no painel do admin.' },
};

export function BtgConfig() {
  const { data, isLoading } = useWhatsappTemplates();
  return (
    <>
      <header className="btg-admin-header">
        <div className="btg-admin-header-title">
          <span>Configurações</span>
          <span>Mensagens e integrações</span>
        </div>
      </header>
      <main className="btg-al-main" style={{ maxWidth: 1040 }}>
        <div className="btg-tabs" role="tablist">
          <button type="button" role="tab" aria-selected="true">
            <Icon name="chat" />
            Mensagens de WhatsApp
          </button>
        </div>
        <p className="btg-soft" style={{ fontSize: 15, lineHeight: '22px' }}>
          Edite as mensagens enviadas por WhatsApp. Use <code className="btg-al-code">{'{firstName}'}</code> e as outras
          variáveis listadas em cada card. Desativar uma mensagem pula o envio sem apagar o texto.
        </p>
        {isLoading ? <Loading /> : (data ?? []).map((tpl) => <TemplateCard key={tpl.kind} template={tpl} />)}
      </main>
    </>
  );
}

function TemplateCard({ template }: { template: WhatsappTemplate }) {
  const update = useUpdateWhatsappTemplate();
  const [text, setText] = useState(template.template);
  const [enabled, setEnabled] = useState(template.enabled);
  const [dirty, setDirty] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  // Re-sync when the server returns a fresh row.
  useEffect(() => {
    setText(template.template);
    setEnabled(template.enabled);
    setDirty(false);
  }, [template.template, template.enabled]);

  const meta = KIND[template.kind] ?? { title: template.kind, subtitle: template.description ?? '' };

  async function save() {
    setNotice(null);
    try {
      await update.mutateAsync({ kind: template.kind, template: text, enabled });
      setDirty(false);
      setNotice({ ok: true, text: 'Mensagem atualizada.' });
    } catch (err) {
      setNotice({ ok: false, text: err instanceof Error ? err.message : 'Falha ao salvar.' });
    }
  }

  return (
    <article className="btg-card btg-card--pad">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span className="btg-card-title">{meta.title}</span>
          <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>{template.kind}</span>
          <span className="btg-soft" style={{ fontSize: 14 }}>{meta.subtitle}</span>
        </div>
        <label className="btg-al-switch">
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setDirty(true);
            }}
          />
          {enabled ? 'Ativa' : 'Desativada'}
        </label>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        <span className="btg-eyebrow" style={{ marginRight: 4 }}>Variáveis</span>
        {template.variables.length === 0 ? (
          <span className="btg-mute" style={{ fontSize: 13 }}>Sem variáveis</span>
        ) : (
          template.variables.map((v) => (
            <code key={v} className="btg-al-code">{`{${v}}`}</code>
          ))
        )}
      </div>

      <textarea
        className="btg-textarea"
        rows={3}
        aria-label={`Texto de ${meta.title}`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
      />

      {notice && (
        <div className={`btg-notice ${notice.ok ? 'btg-notice--ok' : 'btg-notice--bad'}`}>
          <Icon name={notice.ok ? 'check_circle' : 'error'} />
          {notice.text}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span className="btg-mono btg-mute" style={{ fontSize: 12 }}>
          {template.updatedAt
            ? `Última edição · ${new Date(template.updatedAt).toLocaleString('pt-BR')}`
            : 'Nunca editada (texto padrão)'}
        </span>
        <button
          type="button"
          className="btg-btn btg-btn--primary btg-btn--sm"
          onClick={() => void save()}
          disabled={!dirty || update.isPending || text.trim().length === 0}
        >
          <Icon name="save" />
          {update.isPending ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </article>
  );
}
