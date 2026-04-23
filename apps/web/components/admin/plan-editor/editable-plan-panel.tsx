'use client';
import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { BudgetBadge } from './budget-badge';
import { ItemCard } from './item-card';
import { LibraryPickerModal } from './library-picker-modal';
import type { WeeklyPlan, WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';
import { Eyebrow } from '../../ui/eyebrow';
import { SectionLabel } from '../../ui/section-label';

export interface EditablePlanPanelProps {
  plan: WeeklyPlan;
  context: PlanContextResponse;
  topicNameById: Map<string, string>;
  carryOverLibraryItemIds: Set<string>;
  onItemsChange: (items: WeeklyPlanItem[]) => void;
  onAdminNotesChange: (notes: string) => void;
  onAddLibraryItem: (libraryItemId: string) => void;
  onSaveDraft: () => void;
  onPublish: () => void;
  saving: boolean;
  publishing: boolean;
}

function formatShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function EditablePlanPanel({
  plan,
  context,
  topicNameById,
  carryOverLibraryItemIds,
  onItemsChange,
  onAdminNotesChange,
  onAddLibraryItem,
  onSaveDraft,
  onPublish,
  saving,
  publishing,
}: EditablePlanPanelProps) {
  const [createCalendarEvents, setCreateCalendarEvents] = useState(true);
  const [sendWhatsapp, setSendWhatsapp] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);

  const plannedMinutes = useMemo(
    () => plan.items.reduce((s, i) => s + i.libraryItem.estimatedMinutes, 0),
    [plan.items],
  );
  const budgetMinutes = context.availability.weeklyBudgetMinutes;
  const adminNotes = plan.adminNotes ?? '';
  const excludeIds = useMemo(() => new Set(plan.items.map((i) => i.libraryItemId)), [plan.items]);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...plan.items];
    [next[idx - 1], next[idx]] = [next[idx]!, next[idx - 1]!];
    onItemsChange(next.map((i, ord) => ({ ...i, order: ord })));
  };
  const moveDown = (idx: number) => {
    if (idx === plan.items.length - 1) return;
    const next = [...plan.items];
    [next[idx + 1], next[idx]] = [next[idx]!, next[idx + 1]!];
    onItemsChange(next.map((i, ord) => ({ ...i, order: ord })));
  };
  const remove = (idx: number) => {
    const next = plan.items.filter((_, i) => i !== idx);
    onItemsChange(next.map((i, ord) => ({ ...i, order: ord })));
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Eyebrow>The plan · editable</Eyebrow>
        <h2 className="font-serif-tool text-2xl font-semibold tracking-tight text-ink">
          Week {context.cycle.weekNumber} · {formatShort(plan.weekStart)} — {formatShort(plan.weekEnd)}
        </h2>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-xs text-ink-mute">
            {plan.items.length} items · {plannedMinutes} min
          </span>
          <BudgetBadge plannedMinutes={plannedMinutes} budgetMinutes={budgetMinutes} />
        </div>
      </header>

      <section className="space-y-3">
        {plan.items.length === 0 ? (
          <p className="font-mono text-xs text-ink-mute py-8 text-center border border-dashed border-rule rounded-card">
            No items yet. Use the AI draft panel or search the library below.
          </p>
        ) : (
          plan.items.map((item, idx) => (
            <ItemCard
              key={item.id}
              item={item}
              order={idx}
              isCarriedOver={carryOverLibraryItemIds.has(item.libraryItemId)}
              topicName={item.libraryItem.topicId ? topicNameById.get(item.libraryItem.topicId) ?? null : null}
              canMoveUp={idx > 0}
              canMoveDown={idx < plan.items.length - 1}
              onMoveUp={() => moveUp(idx)}
              onMoveDown={() => moveDown(idx)}
              onRemove={() => remove(idx)}
            />
          ))
        )}
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="w-full inline-flex items-center justify-center gap-2 rounded-input border border-dashed border-rule bg-paper px-3 py-3 font-mono text-xs uppercase tracking-label text-ink-soft hover:border-ink/30 hover:bg-paper-warm"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Add from library
        </button>
      </section>

      <LibraryPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        memberTrack={context.member.track}
        itemsCount={plan.items.length}
        plannedMinutes={plannedMinutes}
        budgetMinutes={budgetMinutes}
        selectedLibraryItemIds={excludeIds}
        onAdd={onAddLibraryItem}
      />

      <section>
        <SectionLabel>Admin notes · private</SectionLabel>
        <textarea
          value={adminNotes}
          onChange={(e) => onAdminNotesChange(e.target.value)}
          rows={4}
          placeholder="Notas privadas — só admin lê."
          className="mt-2 w-full rounded-input border border-rule bg-paper p-3 font-sans text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
      </section>

      <section>
        <SectionLabel>Publication</SectionLabel>
        <div className="mt-2 space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={createCalendarEvents}
              onChange={(e) => setCreateCalendarEvents(e.target.checked)}
              className="accent-ink"
            />
            <span className="font-sans text-sm text-ink">Create Google Calendar events (with ICS ID)</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWhatsapp}
              onChange={(e) => setSendWhatsapp(e.target.checked)}
              className="accent-ink"
            />
            <span className="font-sans text-sm text-ink">Send WhatsApp notification to member</span>
          </label>
        </div>
      </section>

      <footer className="flex justify-end gap-3 pt-6 border-t border-rule">
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={saving}
          className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save draft'}
        </button>
        <button
          type="button"
          onClick={onPublish}
          disabled={publishing || plan.items.length === 0}
          className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90 disabled:opacity-40"
        >
          {publishing ? 'Publishing…' : 'Publish & schedule'}
        </button>
      </footer>
    </div>
  );
}
