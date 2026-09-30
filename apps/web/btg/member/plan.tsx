'use client';

import { isPositiveOutcome } from '@ics-select/shared';
import { useMeHome } from '../../lib/queries/me-home';
import { Loading } from '../ui';
import { ItemList } from './rows';

export function BtgPlan() {
  const { data, isLoading, error } = useMeHome();
  if (isLoading) return <Loading />;
  if (error || !data) return <Loading label="Não foi possível carregar seu plano." />;

  const all = [...(data.late ?? []), ...data.today, ...data.days.flatMap((d) => d.items), ...(data.unscheduled ?? [])];
  const done = all.filter((i) => isPositiveOutcome(i.outcome)).length;
  const activeId = data.hero && 'item' in data.hero ? data.hero.item.id : null;

  return (
    <main className="btg-main" style={{ gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 1064 }}>
      <div className="btg-stack">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="btg-eyebrow">Seu plano</span>
          <h1 style={{ fontSize: 32, lineHeight: '40px' }}>Plano da semana</h1>
          <span className="btg-soft">
            {done} de {all.length} itens concluídos
          </span>
        </div>
        {(data.late?.length ?? 0) > 0 && <ItemList title="Pendentes desta semana" items={data.late ?? []} />}
        <ItemList title="Hoje" items={data.today} activeId={activeId} />
        {data.days.map((d) => (
          <ItemList key={d.date} title={d.label} items={d.items} />
        ))}
        {(data.unscheduled?.length ?? 0) > 0 && (
          <ItemList title="Sem horário na agenda" items={data.unscheduled ?? []} />
        )}
      </div>
    </main>
  );
}
