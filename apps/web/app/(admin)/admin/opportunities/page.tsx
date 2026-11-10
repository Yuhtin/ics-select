'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useOpportunities, type OpportunityDto } from '../../../../lib/queries/opportunities';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { OpportunitiesTable } from '../../../../components/admin/opportunities/opportunities-table';
import { OpportunityFormModal } from '../../../../components/opportunities/opportunity-form-modal';

export default function AdminOpportunitiesPage() {
  const { data, isLoading, error } = useOpportunities();
  const [editing, setEditing] = useState<OpportunityDto | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>Admin</Eyebrow>
          <h1 className="font-sans text-3xl font-semibold leading-tight tracking-tight text-fg">Opportunities</h1>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-pill bg-primary px-4 py-2 font-sans text-xs text-primary-fg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New opportunity
        </button>
      </header>

      {isLoading && <p className="font-sans text-xs text-fg-mute">Loading…</p>}
      {error && <p className="font-sans text-sm text-outcome-stuck">Failed to load opportunities.</p>}
      {data && data.length === 0 && <p className="font-sans text-sm text-fg-mute">No opportunities yet.</p>}
      {data && data.length > 0 && <OpportunitiesTable rows={data} onEdit={setEditing} />}

      <OpportunityFormModal
        mode="admin"
        isOpen={creating || !!editing}
        initial={editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        onSaved={() => { setCreating(false); setEditing(null); }}
      />
    </div>
  );
}
