'use client';

import { useState } from 'react';
import { OPPORTUNITY_TYPE_LABELS, type OpportunityStatus } from '@ics-select/shared';
import {
  useDeleteOpportunity,
  useSaveOpportunity,
  type OpportunityDto,
} from '../../../lib/queries/opportunities';
import { ConfirmDialog } from '../../ui/confirm-dialog';
import { shortDate } from '../../opportunities/opportunity-card';
import { InterestListPopover } from './interest-list-popover';

// ponytail: Source Serif 4 isn't loaded in the app yet; admin tables use font-sans + tabular-nums.
const ACTION = 'rounded-pill px-2.5 py-1 text-xs text-fg-soft hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';
const TRANSITIONS: Record<OpportunityStatus, { label: string; to: OpportunityStatus } | null> = {
  DRAFT: { label: 'Publish', to: 'PUBLISHED' },
  PUBLISHED: { label: 'Archive', to: 'ARCHIVED' },
  ARCHIVED: { label: 'Unarchive', to: 'PUBLISHED' },
};

export function OpportunitiesTable({
  rows,
  onEdit,
}: {
  rows: OpportunityDto[];
  onEdit: (o: OpportunityDto) => void;
}) {
  const save = useSaveOpportunity();
  const del = useDeleteOpportunity();
  const [toDelete, setToDelete] = useState<OpportunityDto | null>(null);

  return (
    <>
      {save.isError && (
        <p role="alert" className="mb-3 font-sans text-sm text-outcome-stuck">
          Could not update the opportunity. Try again.
        </p>
      )}
      <div className="overflow-x-auto rounded-card border border-border-token bg-surface">
        <table className="w-full min-w-[960px] border-collapse text-left font-sans text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border-token text-xs text-fg-mute">
              {['Title', 'Company', 'Type', 'Status', 'Closes', 'Author', 'Interested', ''].map((h) => (
                <th key={h || 'actions'} scope="col" className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => {
              const date = o.deadline ?? o.eventDate;
              const next = TRANSITIONS[o.status];
              return (
                <tr key={o.id} className="border-b border-border-token last:border-0">
                  <td className="px-4 py-3 text-fg">{o.title}</td>
                  <td className="px-4 py-3 text-fg-soft">{o.companyName}</td>
                  <td className="px-4 py-3 text-fg-soft">{OPPORTUNITY_TYPE_LABELS[o.type]}</td>
                  <td className="px-4 py-3 text-xs text-fg-soft">{o.status}</td>
                  <td className="px-4 py-3 text-fg-soft">{date ? shortDate(date) : '—'}</td>
                  <td className="px-4 py-3 text-fg-soft">{o.createdBy.name}</td>
                  <td className="px-4 py-3"><InterestListPopover interests={o.interests} /></td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" className={ACTION} onClick={() => onEdit(o)}>Edit</button>
                      {next && (
                        <button
                          type="button"
                          className={ACTION}
                          disabled={save.isPending}
                          onClick={() => { save.reset(); save.mutate({ id: o.id, input: { status: next.to } }); }}
                        >
                          {next.label}
                        </button>
                      )}
                      <button type="button" className={ACTION} onClick={() => { del.reset(); setToDelete(o); }}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        isOpen={!!toDelete}
        onClose={() => { del.reset(); setToDelete(null); }}
        title="Delete opportunity?"
        description={toDelete && (
          <>
            <p>{`"${toDelete.title}" and its interest flags will be removed. This cannot be undone.`}</p>
            {del.isError && (
              <p role="alert" className="mt-2 text-outcome-stuck">Could not delete the opportunity. Try again.</p>
            )}
          </>
        )}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={del.isPending}
        onConfirm={() => toDelete && del.mutate(toDelete.id, { onSuccess: () => setToDelete(null) })}
      />
    </>
  );
}
