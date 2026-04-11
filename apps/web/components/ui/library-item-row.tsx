'use client';

import { Button } from '@heroui/react';
import { BookOpen, ChevronRight, type LucideIcon } from 'lucide-react';
import { StatusChip, type StatusChipStatus } from './status-chip';

interface LibraryItemRowProps {
  icon?: LucideIcon;
  title: string;
  source: string;
  estimatedMinutes?: number | null;
  tags?: string[];
  status: StatusChipStatus;
  onClick?: () => void;
}

export function LibraryItemRow({
  icon: Icon = BookOpen,
  title,
  source,
  estimatedMinutes,
  tags = [],
  status,
  onClick,
}: LibraryItemRowProps) {
  const metadata: string[] = [source];
  if (estimatedMinutes) metadata.push(`~${estimatedMinutes}min`);
  if (tags.length) metadata.push(tags.slice(0, 2).join(', '));

  return (
    <div className="rounded-lg border border-border bg-surface p-4 hover:bg-surface-muted transition-colors flex items-center gap-4">
      <div className="h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold text-foreground truncate">{title}</p>
        <p className="text-xs text-foreground-muted mt-0.5 truncate">
          {metadata.join(' · ')}
        </p>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <StatusChip status={status} />
        <Button
          size="sm"
          variant="light"
          color="default"
          isIconOnly
          onPress={onClick}
          aria-label="Ver detalhes"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
