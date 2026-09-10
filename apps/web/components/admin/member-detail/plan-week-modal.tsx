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
          ? 'border-border-token bg-bg-subtle opacity-60 cursor-not-allowed'
          : 'border-border-token bg-surface hover:border-primary hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      )}
    >
      <div className="min-w-0">
        <div className="font-sans text-xs text-fg-mute">
          {label}
        </div>
        <div className="mt-0.5 font-sans text-base font-semibold text-fg">
          {formatWeekLabel(slot.weekStart, slot.weekEnd)}
        </div>
        <div className="mt-1 font-sans text-xs text-fg-soft">
          {disabled
            ? 'Outside cycle'
            : hasPlan
              ? `${action} existing plan · ${slot.status}`
              : `${action} new plan`}
        </div>
      </div>
      {!disabled && (
        <ArrowRight
          className="h-4 w-4 text-fg-mute group-hover:text-fg"
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
      classNames={{ base: 'border border-border-token bg-surface text-fg rounded-card shadow-modal', closeButton: 'text-fg-mute hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-primary' }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 font-sans">
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
