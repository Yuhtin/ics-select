export type StatusChipStatus =
  | 'pending'
  | 'in_progress'
  | 'done_easy'
  | 'done_hard'
  | 'stuck';

interface StatusChipProps {
  status: StatusChipStatus;
  label?: string;
}

const statusStyles: Record<StatusChipStatus, { className: string; defaultLabel: string }> = {
  pending: {
    className: 'bg-surface-subtle text-foreground-muted',
    defaultLabel: 'Pendente',
  },
  in_progress: {
    className: 'bg-info-soft text-info',
    defaultLabel: 'Em progresso',
  },
  done_easy: {
    className: 'bg-success-soft text-success',
    defaultLabel: 'Concluído · Fácil',
  },
  done_hard: {
    className: 'bg-warning-soft text-warning',
    defaultLabel: 'Concluído · Difícil',
  },
  stuck: {
    className: 'bg-danger-soft text-danger',
    defaultLabel: 'Travado',
  },
};

export function StatusChip({ status, label }: StatusChipProps) {
  const config = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {label ?? config.defaultLabel}
    </span>
  );
}
