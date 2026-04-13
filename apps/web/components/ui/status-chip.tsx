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

const statusStyles: Record<StatusChipStatus, { className: string; dotClassName: string; defaultLabel: string }> = {
  pending: {
    className: 'bg-surface-subtle text-foreground-muted',
    dotClassName: 'bg-foreground-muted',
    defaultLabel: 'Pendente',
  },
  in_progress: {
    className: 'bg-info-soft text-info',
    dotClassName: 'bg-info',
    defaultLabel: 'Em progresso',
  },
  done_easy: {
    className: 'bg-success-soft text-success',
    dotClassName: 'bg-success',
    defaultLabel: 'Concluído · Fácil',
  },
  done_hard: {
    className: 'bg-warning-soft text-warning',
    dotClassName: 'bg-warning',
    defaultLabel: 'Concluído · Difícil',
  },
  stuck: {
    className: 'bg-danger-soft text-danger',
    dotClassName: 'bg-danger',
    defaultLabel: 'Travado',
  },
};

export function StatusChip({ status, label }: StatusChipProps) {
  const config = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {label ?? config.defaultLabel}
    </span>
  );
}
