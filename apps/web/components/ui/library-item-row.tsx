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
    <div className="rounded-card border border-border-token bg-surface p-4 hover:bg-surface-hover transition-colors flex flex-wrap items-center gap-3 sm:gap-4">
      <div className="h-10 w-10 rounded-input bg-bg-subtle text-fg-soft flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-sans text-base font-semibold text-fg truncate">{title}</p>
        <p className="text-xs text-fg-mute mt-0.5 truncate">
          {metadata.join(' · ')}
        </p>
      </div>

      <div className="ml-auto flex w-full items-center justify-end gap-3 flex-shrink-0 sm:w-auto">
        <StatusChip status={status} />
        <Button
          size="sm"
          variant="light"
          color="default"
          isIconOnly
          onPress={onClick}
          aria-label="Ver detalhes"
          className="min-h-11 min-w-11 rounded-input text-fg hover:bg-bg-subtle focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg data-[focus-visible=true]:outline-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
