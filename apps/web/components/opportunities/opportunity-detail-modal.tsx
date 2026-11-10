'use client';

import { clsx } from 'clsx';
import { Archive, ExternalLink, Linkedin, Mail, MessageCircle, Pencil } from 'lucide-react';
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { daysUntilClose, whatsappHref } from '@ics-select/shared';
import type { ReactNode } from 'react';
import type { OpportunityDto } from '../../lib/queries/opportunities';
import { AvatarStack, InterestButton, TypeMeta, isUrgent, placeLine, shortDate } from './opportunity-card';

function publishedAgo(iso: string | null): string | null {
  if (!iso) return null;
  const d = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return d <= 0 ? 'Publicado hoje' : `Publicado há ${d} dia${d === 1 ? '' : 's'}`;
}

function interestSentence(o: OpportunityDto): string {
  const names = o.interests.map((i) => i.name.split(' ')[0]);
  if (names.length === 0) return 'Ninguém ainda';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
  return `${list} ${names.length === 1 ? 'tem' : 'têm'} interesse`;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

function deadlineFact(o: OpportunityDto): string {
  const date = o.deadline ?? o.eventDate;
  if (!date) return 'Sem prazo';
  const label = o.deadline ? shortDate(date) : `Evento ${shortDate(date)}`;
  const d = daysUntilClose(o, new Date());
  if (!o.isOpen || d === null) return label;
  return `${label} · ${d === 0 ? 'hoje' : `${d} dia${d === 1 ? '' : 's'}`}`;
}

const SECTION = 'mb-2 font-mono text-[11px] uppercase tracking-label text-fg-mute';
const ACTION =
  'inline-flex min-h-9 items-center gap-1.5 rounded-input border border-border-token bg-surface px-3 font-sans text-xs font-semibold text-fg hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

function Fact({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0 py-3 sm:px-4 sm:first:pl-0">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">{k}</p>
      <p className={clsx('mt-1', className ?? 'font-sans text-sm text-fg')}>{children}</p>
    </div>
  );
}

export function OpportunityDetailModal({
  o,
  meId,
  onClose,
  onToggleInterest,
  onEdit,
  onArchive,
}: {
  o: OpportunityDto | null;
  meId: string | undefined;
  onClose: () => void;
  onToggleInterest: (o: OpportunityDto) => void;
  onEdit: (o: OpportunityDto) => void;
  onArchive: (o: OpportunityDto) => void;
}) {
  const mine = !!o && !!meId && o.createdBy.id === meId;
  return (
    <Modal isOpen={!!o} onClose={onClose} placement="center" size="2xl" scrollBehavior="inside">
      <ModalContent className="rounded-[12px] border border-border-token bg-bg">
        {o && (
          <>
            <ModalHeader className="flex flex-col gap-0 border-b border-border-token bg-surface px-7 pb-4 pt-6">
              <div className="flex items-center gap-2 pr-6">
                <TypeMeta o={o} />
                <span className="ml-auto font-sans text-xs font-normal text-fg-mute">{publishedAgo(o.publishedAt)}</span>
              </div>
              <p className="mt-2.5 font-sans text-[13px] font-semibold text-fg-soft">{o.companyName}</p>
              <h2 className="mt-1 font-serif text-[26px] font-medium leading-tight text-fg">{o.title}</h2>
              {o.createdBy.role === 'MEMBER' && (
                <p className="mt-1 font-sans text-xs font-normal text-fg-mute">Shared by {o.createdBy.name}</p>
              )}
            </ModalHeader>
            <ModalBody className="gap-5 px-7 py-5">
              <div className="grid divide-y divide-border-token border-y border-border-token sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0">
                <Fact k="Deadline" className={clsx('font-mono text-[13px]', isUrgent(o) ? 'font-semibold text-outcome-done-hard' : 'text-fg')}>
                  {deadlineFact(o)}
                </Fact>
                {placeLine(o) && <Fact k="Local">{placeLine(o)}</Fact>}
                {o.compensation && <Fact k="Compensação">{o.compensation}</Fact>}
              </div>

              {o.description && (
                <p className="whitespace-pre-line font-serif text-base leading-relaxed text-fg-soft">{o.description}</p>
              )}

              {o.links.length > 0 && (
                <section>
                  <p className={SECTION}>Links</p>
                  <ul className="space-y-1.5">
                    {o.links.map((l) => (
                      <li key={l.url}>
                        <a
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-between gap-3 rounded-input border border-border-token bg-surface px-3 py-2.5 font-sans text-[13px] text-fg hover:bg-surface-hover"
                        >
                          <span className="min-w-0 truncate">{l.label}</span>
                          <span className="flex shrink-0 items-center gap-1 font-mono text-[11px] text-fg-mute">
                            {domainOf(l.url)}
                            <ExternalLink aria-hidden="true" className="h-3 w-3" strokeWidth={1.5} />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {o.contacts.length > 0 && (
                <section>
                  <p className={SECTION}>Contato</p>
                  <ul className="space-y-1.5">
                    {o.contacts.map((c, i) => (
                      <li
                        key={`${c.name}-${i}`}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-input border border-border-token bg-surface p-3"
                      >
                        <div className="min-w-0">
                          <p className="font-sans text-[13px] font-semibold text-fg">{c.name}</p>
                          {c.role && <p className="font-sans text-xs text-fg-mute">{c.role}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {c.whatsapp && (
                            <a href={whatsappHref(c.whatsapp)} target="_blank" rel="noopener noreferrer" className={ACTION}>
                              <MessageCircle aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                              WhatsApp
                            </a>
                          )}
                          {c.email && (
                            <a href={`mailto:${c.email}`} className={ACTION}>
                              <Mail aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                              E-mail
                            </a>
                          )}
                          {c.linkedin && (
                            <a href={c.linkedin} target="_blank" rel="noopener noreferrer" className={ACTION}>
                              <Linkedin aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                              LinkedIn
                            </a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {mine && o.status !== 'ARCHIVED' && (
                <div className="flex gap-2">
                  <button type="button" className={ACTION} onClick={() => onEdit(o)}>
                    <Pencil aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Edit
                  </button>
                  <button type="button" className={ACTION} onClick={() => onArchive(o)}>
                    <Archive aria-hidden="true" className="h-3.5 w-3.5" strokeWidth={1.5} />
                    Archive
                  </button>
                </div>
              )}
            </ModalBody>
            <ModalFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-border-token bg-surface px-7 py-3.5">
              <span className="flex min-w-0 items-center gap-1.5">
                <AvatarStack people={o.interests} />
                <small className="font-sans text-xs text-fg-mute">{interestSentence(o)}</small>
              </span>
              <InterestButton o={o} onToggle={() => onToggleInterest(o)} className="min-h-10 px-4 text-[13px]">
                Tenho interesse
              </InterestButton>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
