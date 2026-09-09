'use client';

import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  type ButtonProps,
  type ModalProps,
} from '@heroui/react';
import type { ReactNode } from 'react';
import { clsx } from 'clsx';

const confirmStyles: Record<NonNullable<ButtonProps['color']>, string> = {
  default: 'bg-surface-strong text-fg',
  primary: 'bg-primary text-primary-fg',
  secondary: 'bg-primary-soft text-fg',
  success: 'bg-success-soft text-fg border border-success',
  warning: 'bg-warn-soft text-fg border border-warn',
  danger: 'bg-danger-soft text-fg border border-danger',
};

const controlStyles = 'min-h-11 rounded-input font-sans focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg data-[focus-visible=true]:outline-primary data-[focus-visible=true]:outline-offset-2';

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColor?: ButtonProps['color'];
  isLoading?: boolean;
  /** Forwarded to the underlying HeroUI Modal — use to override z-index when nested inside another modal. */
  classNames?: ModalProps['classNames'];
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  confirmColor = 'danger',
  isLoading = false,
  classNames,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      size="sm"
      backdrop="blur"
      classNames={{
        ...classNames,
        base: clsx('rounded-card border border-border-token bg-surface text-fg shadow-modal', classNames?.base),
        closeButton: clsx('min-h-11 min-w-11 rounded-input text-fg-mute hover:bg-surface-hover focus-visible:outline-primary', classNames?.closeButton),
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1 pr-14 font-sans">{title}</ModalHeader>
        {description && (
          <ModalBody>
            <div className="text-sm text-fg-soft">{description}</div>
          </ModalBody>
        )}
        <ModalFooter>
          <Button variant="light" className={clsx(controlStyles, 'border border-border-token bg-surface text-fg hover:bg-surface-hover')} onPress={onClose} isDisabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button color={confirmColor} className={clsx(controlStyles, confirmStyles[confirmColor])} onPress={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
