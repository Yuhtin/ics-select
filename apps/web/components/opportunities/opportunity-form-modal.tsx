'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_TYPE_LABELS,
  OpportunityInputSchema,
  WORK_MODES,
  type OpportunityStatus,
} from '@ics-select/shared';
import { useSaveOpportunity, type OpportunityDto } from '../../lib/queries/opportunities';
import { WORK_MODE_LABELS } from './opportunity-card';

type Link = { label: string; url: string };
type Contact = { name: string; role: string; whatsapp: string; email: string; linkedin: string };
type Form = {
  title: string; type: string; companyName: string; description: string; location: string;
  workMode: string; compensation: string; deadline: string; eventDate: string; status: string;
  links: Link[]; contacts: Contact[];
};

const EMPTY_CONTACT: Contact = { name: '', role: '', whatsapp: '', email: '', linkedin: '' };

function toForm(o: OpportunityDto | null | undefined): Form {
  return {
    title: o?.title ?? '',
    type: o?.type ?? '',
    companyName: o?.companyName ?? '',
    description: o?.description ?? '',
    location: o?.location ?? '',
    workMode: o?.workMode ?? '',
    compensation: o?.compensation ?? '',
    deadline: o?.deadline ?? '',
    eventDate: o?.eventDate ?? '',
    status: o?.status ?? 'DRAFT',
    links: o?.links.map((l) => ({ ...l })) ?? [],
    contacts: o?.contacts.map((c) => ({ ...EMPTY_CONTACT, ...c })) ?? [],
  };
}

const opt = (s: string) => s.trim() || undefined;
// Blank top-level optionals go as null so a PATCH clears the column (undefined would be dropped by JSON).
const clearable = (s: string) => s.trim() || null;

/** Form state → API body. */
function toInput(f: Form, mode: 'member' | 'admin') {
  return {
    title: f.title.trim(),
    type: f.type,
    companyName: f.companyName.trim(),
    description: clearable(f.description),
    location: clearable(f.location),
    workMode: clearable(f.workMode),
    compensation: clearable(f.compensation),
    deadline: f.deadline || null,
    eventDate: f.eventDate || null,
    links: f.links.filter((l) => l.label.trim() || l.url.trim()).map((l) => ({ label: l.label.trim(), url: l.url.trim() })),
    contacts: f.contacts
      .filter((c) => Object.values(c).some((v) => v.trim()))
      .map((c) => ({
        name: c.name.trim(), role: opt(c.role), whatsapp: opt(c.whatsapp), email: opt(c.email), linkedin: opt(c.linkedin),
      })),
    ...(mode === 'admin' ? { status: f.status } : {}),
  };
}

const INPUT =
  'min-h-10 w-full rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary';
const ROW_BTN =
  'inline-flex min-h-9 items-center gap-1.5 rounded-input border border-border-token bg-surface px-3 font-sans text-xs font-semibold text-fg hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block space-y-1 ${className ?? ''}`}>
      <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">{label}</span>
      {children}
    </label>
  );
}

function RemoveButton({ onPress, label }: { onPress: () => void; label: string }) {
  return (
    <button type="button" aria-label={label} onClick={onPress} className="grid h-10 w-10 shrink-0 place-items-center rounded-input text-fg-mute hover:bg-surface-hover hover:text-fg">
      <X aria-hidden="true" className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}

export function OpportunityFormModal({
  mode,
  isOpen,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'member' | 'admin';
  isOpen: boolean;
  /** Present = edit (PATCH); absent = create (POST). */
  initial?: OpportunityDto | null;
  onClose: () => void;
  onSaved?: (o: OpportunityDto) => void;
}) {
  const [f, setF] = useState<Form>(() => toForm(initial));
  const [error, setError] = useState<string | null>(null);
  const save = useSaveOpportunity();

  useEffect(() => {
    if (isOpen) {
      setF(toForm(initial));
      setError(null);
    }
  }, [isOpen, initial]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));
  const setLink = (i: number, patch: Partial<Link>) =>
    set('links', f.links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setContact = (i: number, patch: Partial<Contact>) =>
    set('contacts', f.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const submit = () => {
    const parsed = OpportunityInputSchema.safeParse(toInput(f, mode));
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      setError(`${issue.path.join('.') || 'form'}: ${issue.message}`);
      return;
    }
    setError(null);
    save.mutate(
      { id: initial?.id, input: parsed.data },
      {
        onSuccess: (o) => {
          onSaved?.(o);
          onClose();
        },
        onError: (e) => setError(e instanceof Error ? e.message : 'Could not save.'),
      },
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} placement="center" size="2xl" scrollBehavior="inside">
      <ModalContent className="rounded-[12px] border border-border-token bg-surface">
        <ModalHeader className="font-sans text-xl font-semibold text-fg">
          {initial ? 'Edit opportunity' : mode === 'member' ? 'Share an opportunity' : 'New opportunity'}
        </ModalHeader>
        <ModalBody className="space-y-4">
          <form
            id="opportunity-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <Field label="Title">
              <input className={INPUT} value={f.title} onChange={(e) => set('title', e.target.value)} required maxLength={160} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Company">
                <input className={INPUT} value={f.companyName} onChange={(e) => set('companyName', e.target.value)} required maxLength={120} />
              </Field>
              <Field label="Type">
                <select className={INPUT} value={f.type} onChange={(e) => set('type', e.target.value)} required>
                  <option value="" disabled>Select…</option>
                  {OPPORTUNITY_TYPES.map((t) => (
                    <option key={t} value={t}>{OPPORTUNITY_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Location">
                <input className={INPUT} value={f.location} onChange={(e) => set('location', e.target.value)} maxLength={120} />
              </Field>
              <Field label="Work mode">
                <select className={INPUT} value={f.workMode} onChange={(e) => set('workMode', e.target.value)}>
                  <option value="">—</option>
                  {WORK_MODES.map((m) => (
                    <option key={m} value={m}>{WORK_MODE_LABELS[m]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Compensation">
                <input className={INPUT} value={f.compensation} onChange={(e) => set('compensation', e.target.value)} maxLength={120} />
              </Field>
              {mode === 'admin' && (
                <Field label="Status">
                  <select className={INPUT} value={f.status} onChange={(e) => set('status', e.target.value as OpportunityStatus)}>
                    {OPPORTUNITY_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </Field>
              )}
              <Field label="Deadline">
                <input type="date" className={INPUT} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
              </Field>
              <Field label="Event date">
                <input type="date" className={INPUT} value={f.eventDate} onChange={(e) => set('eventDate', e.target.value)} />
              </Field>
            </div>
            <Field label="Description">
              <textarea className={`${INPUT} min-h-28`} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
            </Field>

            <fieldset className="space-y-2">
              <legend className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">Links</legend>
              {f.links.map((l, i) => (
                <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
                  <input className={INPUT} aria-label={`Link ${i + 1} label`} placeholder="Label" value={l.label} onChange={(e) => setLink(i, { label: e.target.value })} />
                  <input className={INPUT} aria-label={`Link ${i + 1} URL`} placeholder="https://" type="url" value={l.url} onChange={(e) => setLink(i, { url: e.target.value })} />
                  <RemoveButton label={`Remove link ${i + 1}`} onPress={() => set('links', f.links.filter((_, j) => j !== i))} />
                </div>
              ))}
              <button type="button" className={ROW_BTN} onClick={() => set('links', [...f.links, { label: '', url: '' }])}>
                <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> Add link
              </button>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">Contacts</legend>
              {f.contacts.map((c, i) => (
                <div key={i} className="flex gap-2 rounded-input border border-border-token p-2">
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <input className={INPUT} aria-label={`Contact ${i + 1} name`} placeholder="Name" value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} />
                    <input className={INPUT} aria-label={`Contact ${i + 1} role`} placeholder="Role" value={c.role} onChange={(e) => setContact(i, { role: e.target.value })} />
                    <input className={INPUT} aria-label={`Contact ${i + 1} WhatsApp`} placeholder="WhatsApp" value={c.whatsapp} onChange={(e) => setContact(i, { whatsapp: e.target.value })} />
                    <input className={INPUT} aria-label={`Contact ${i + 1} e-mail`} placeholder="E-mail" type="email" value={c.email} onChange={(e) => setContact(i, { email: e.target.value })} />
                    <input className={`${INPUT} sm:col-span-2`} aria-label={`Contact ${i + 1} LinkedIn`} placeholder="https://linkedin.com/in/…" type="url" value={c.linkedin} onChange={(e) => setContact(i, { linkedin: e.target.value })} />
                  </div>
                  <RemoveButton label={`Remove contact ${i + 1}`} onPress={() => set('contacts', f.contacts.filter((_, j) => j !== i))} />
                </div>
              ))}
              <button type="button" className={ROW_BTN} onClick={() => set('contacts', [...f.contacts, { ...EMPTY_CONTACT }])}>
                <Plus aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} /> Add contact
              </button>
            </fieldset>

            {error && (
              <p className="font-sans text-sm text-outcome-stuck" role="alert">{error}</p>
            )}
          </form>
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={onClose} className="min-h-11 rounded-input px-4 font-sans text-sm text-fg hover:bg-surface-hover">
            Cancel
          </button>
          <button
            type="submit"
            form="opportunity-form"
            disabled={save.isPending}
            className="min-h-11 rounded-input bg-fg px-4 font-sans text-sm font-semibold text-bg hover:bg-fg/90 disabled:opacity-50"
          >
            {initial ? 'Save' : mode === 'member' ? 'Share' : 'Create'}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
