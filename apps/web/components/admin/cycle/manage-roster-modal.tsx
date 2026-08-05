'use client';

import { useMemo, useState } from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react';
import { clsx } from 'clsx';
import { Search, X } from 'lucide-react';
import { ApiErrorResponse } from '../../../lib/api/client';
import { useAdminMembers } from '../../../lib/queries/admin-members-list';
import {
  useAddCycleMember,
  useRemoveCycleMember,
} from '../../../lib/queries/admin-cycle-members';
import type { CycleOverviewMember } from '../../../lib/queries/admin-cycle';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  cycleId: string;
  cycleName: string;
  members: CycleOverviewMember[];
};

export function ManageRosterModal({
  isOpen,
  onClose,
  cycleId,
  cycleName,
  members,
}: Props) {
  const { data: allUsers, isLoading } = useAdminMembers();
  const add = useAddCycleMember();
  const remove = useRemoveCycleMember();

  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Keyed by userId so a conflict on one person doesn't hide the others.
  const [errors, setErrors] = useState<Record<string, string>>({});

  const inCycle = useMemo(
    () => new Set(members.map((m) => m.userId)),
    [members],
  );

  // Admins are excluded: they run the program, they don't enrol in it. The
  // invite form applies the same rule (cycle select disabled for ADMIN).
  const candidates = useMemo(() => {
    if (!allUsers) return [];
    const q = query.trim().toLowerCase();
    return allUsers
      .filter((u) => u.role !== 'ADMIN' && !inCycle.has(u.id))
      .filter(
        (u) =>
          !q ||
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allUsers, inCycle, query]);

  function toggle(userId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  // The overlap conflict arrives as code 'CONFLICT', not the specific
  // 'member-already-in-overlapping-cycle': HttpExceptionFilter only forwards a
  // custom code when the thrown object has an `error` key, and addMember
  // throws a bare {code, message}. The message survives and already names the
  // conflicting cycle, so it is what we show.
  function messageFor(err: unknown): string {
    if (err instanceof ApiErrorResponse) {
      return err.apiError?.message ?? 'Não foi possível adicionar.';
    }
    return 'Não foi possível adicionar.';
  }

  // Sequential, not Promise.all: the overlap check is a read-then-write on the
  // same rows, and a burst of parallel writes makes the per-person error
  // impossible to attribute. 12 people is not worth the concurrency.
  async function handleAdd() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const failures: Record<string, string> = {};
    for (const userId of ids) {
      try {
        await add.mutateAsync({ cycleId, userId });
      } catch (err) {
        failures[userId] = messageFor(err);
      }
    }
    setErrors(failures);
    setSelected(new Set(Object.keys(failures)));
    if (Object.keys(failures).length === 0) setQuery('');
  }

  const busy = add.isPending || remove.isPending;

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => {} : onClose}
      placement="center"
      size="2xl"
      backdrop="blur"
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <span className="font-serif-tool text-lg font-semibold">
            Roster · {cycleName}
          </span>
          <span className="font-mono text-[11px] font-normal text-ink-mute">
            {members.length} no ciclo
          </span>
        </ModalHeader>

        <ModalBody className="gap-6">
          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              No ciclo
            </p>
            {members.length === 0 ? (
              <p className="font-mono text-xs text-ink-mute">Ninguém ainda.</p>
            ) : (
              <ul className="divide-y divide-rule rounded-card border border-rule">
                {members.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center gap-3 px-3 py-2"
                  >
                    <span className="flex-1 min-w-0 truncate font-sans text-sm text-ink">
                      {m.name}
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        remove.mutate({ cycleId, userId: m.userId })
                      }
                      aria-label={`Remover ${m.name} do ciclo`}
                      className="rounded-input p-1 text-ink-mute transition-colors hover:bg-paper-warm hover:text-outcome-stuck disabled:opacity-40"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
              Adicionar
            </p>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
                strokeWidth={1.5}
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome ou email…"
                className="w-full rounded-input border border-rule bg-paper py-2 pl-9 pr-3 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
              />
            </div>

            {isLoading ? (
              <p className="font-mono text-xs text-ink-mute">Carregando…</p>
            ) : candidates.length === 0 ? (
              <p className="rounded-card border border-dashed border-rule py-6 text-center font-mono text-xs text-ink-mute">
                {query ? 'Ninguém encontrado.' : 'Todo mundo já está no ciclo.'}
              </p>
            ) : (
              <ul className="max-h-64 divide-y divide-rule overflow-y-auto rounded-card border border-rule">
                {candidates.map((u) => (
                  <li key={u.id}>
                    <label
                      className={clsx(
                        'flex cursor-pointer items-center gap-3 px-3 py-2 transition-colors hover:bg-paper-warm',
                        errors[u.id] && 'bg-outcome-stuck/5',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggle(u.id)}
                        disabled={busy}
                        className="h-4 w-4 accent-ink"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-sans text-sm text-ink">
                          {u.name}
                        </span>
                        <span className="block truncate font-mono text-[10px] text-ink-mute">
                          {u.email}
                        </span>
                        {errors[u.id] && (
                          <span className="mt-0.5 block font-mono text-[10px] text-outcome-stuck">
                            {errors[u.id]}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </ModalBody>

        <ModalFooter>
          <Button variant="light" onPress={onClose} isDisabled={busy}>
            Fechar
          </Button>
          <Button
            color="primary"
            onPress={handleAdd}
            isLoading={add.isPending}
            isDisabled={selected.size === 0 || busy}
          >
            {selected.size === 0
              ? 'Adicionar'
              : `Adicionar ${selected.size}`}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
