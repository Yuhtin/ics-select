'use client';

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalHeader,
} from '@heroui/react';
import { ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import type { PlanWeekSlot } from '../../../lib/queries/admin-member';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  current: PlanWeekSlot;
  next: PlanWeekSlot;
  onPick: (slot: PlanWeekSlot) => void;
};

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions = {}) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
      ...opts,
    }).format(d);
  return `${fmt(start)} → ${fmt(end)}`;
}

function SlotRow({
  slot,
  label,
  onPick,
}: {
  slot: PlanWeekSlot;
  label: string;
  onPick: (slot: PlanWeekSlot) => void;
}) {
  const hasPlan = slot.planId !== null;
  const action = hasPlan ? 'Edit' : 'Create';
  const disabled = !slot.inCycle && !hasPlan;

  return (
    <button
      type="button"
      onClick={() => !disabled && onPick(slot)}
      disabled={disabled}
      className={clsx(
        'group flex items-center justify-between gap-4 w-full rounded-card border px-4 py-3 text-left transition-colors',
        disabled
          ? 'border-rule bg-paper-warm opacity-60 cursor-not-allowed'
          : 'border-rule bg-surface hover:border-ink hover:bg-paper-warm',
      )}
    >
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
          {label}
        </div>
        <div className="mt-0.5 font-serif-tool text-base font-semibold text-ink">
          {formatWeekLabel(slot.weekStart, slot.weekEnd)}
        </div>
        <div className="mt-1 font-mono text-[11px] text-ink-soft">
          {disabled
            ? 'Outside cycle'
            : hasPlan
              ? `${action} existing plan · ${slot.status}`
              : `${action} new plan`}
        </div>
      </div>
      {!disabled && (
        <ArrowRight
          className="h-4 w-4 text-ink-mute group-hover:text-ink"
          strokeWidth={1.5}
        />
      )}
    </button>
  );
}

export function PlanWeekModal({ isOpen, onClose, current, next, onPick }: Props) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      size="md"
      backdrop="blur"
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 font-serif-tool">
          Plan week
        </ModalHeader>
        <ModalBody className="pb-6">
          <div className="flex flex-col gap-3">
            <SlotRow slot={current} label="Current week" onPick={onPick} />
            <SlotRow slot={next} label="Next week" onPick={onPick} />
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}
