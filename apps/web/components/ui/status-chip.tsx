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
    className: 'bg-bg-subtle text-fg-soft',
    dotClassName: 'bg-fg-mute',
    defaultLabel: 'Pendente',
  },
  in_progress: {
    className: 'bg-primary-soft text-fg',
    dotClassName: 'bg-primary',
    defaultLabel: 'Em progresso',
  },
  done_easy: {
    className: 'bg-success-soft text-fg',
    dotClassName: 'bg-success',
    defaultLabel: 'Concluído · Fácil',
  },
  done_hard: {
    className: 'bg-warn-soft text-fg',
    dotClassName: 'bg-warn',
    defaultLabel: 'Concluído · Difícil',
  },
  stuck: {
    className: 'bg-danger-soft text-fg',
    dotClassName: 'bg-danger',
    defaultLabel: 'Travado',
  },
};

export function StatusChip({ status, label }: StatusChipProps) {
  const config = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1 font-sans text-xs font-medium ${config.className}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.dotClassName}`} />
      {label ?? config.defaultLabel}
    </span>
  );
}
