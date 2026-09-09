'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Button,
} from '@heroui/react';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import {
  isoToSxLocal,
  sxLocalToIso,
  sxToDatetimeLocal,
  datetimeLocalToSx,
} from '../../../lib/calendar/sx-time';

interface RescheduleModalProps {
  event: CalendarEvent | null;
  timezone: string;
  onClose: () => void;
  onSubmit: (input: { eventId: string; start: string; end: string }) => void;
}

export function RescheduleModal({
  event,
  timezone,
  onClose,
  onSubmit,
}: RescheduleModalProps) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setStart(sxToDatetimeLocal(isoToSxLocal(event.start, timezone)));
    setEnd(sxToDatetimeLocal(isoToSxLocal(event.end, timezone)));
    setError(null);
  }, [event, timezone]);

  const handleSubmit = () => {
    if (!event) return;
    if (!start || !end) {
      setError('Preencha os dois horários.');
      return;
    }
    const startIso = sxLocalToIso(datetimeLocalToSx(start), timezone);
    const endIso = sxLocalToIso(datetimeLocalToSx(end), timezone);
    if (new Date(endIso) <= new Date(startIso)) {
      setError('O fim precisa ser depois do início.');
      return;
    }
    onSubmit({ eventId: event.id, start: startIso, end: endIso });
    onClose();
  };

  return (
    <Modal isOpen={!!event} onClose={onClose} placement="center">
      <ModalContent className="rounded-card border border-border-token bg-surface">
        <ModalHeader className="font-sans text-xl font-semibold text-fg">
          Reagendar
        </ModalHeader>
        <ModalBody className="space-y-4">
          <p className="font-sans text-sm text-fg-soft">{event?.title}</p>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
              Início
            </span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="min-h-11 w-full rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
              Fim
            </span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="min-h-11 w-full rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm text-fg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          {error && (
            <p className="font-sans text-sm text-outcome-stuck" role="alert">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose} className="min-h-11 rounded-input text-fg hover:bg-surface-hover">
            Cancelar
          </Button>
          <Button color="primary" onPress={handleSubmit} className="min-h-11 rounded-input bg-primary font-semibold text-primary-fg">
            Reagendar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
