'use client';

import { BookOpen, Check, FileText, HelpCircle, Lock, Video, X } from 'lucide-react';
import { motion } from 'framer-motion';

type NodeStatus = 'pending' | 'active' | 'done' | 'stuck' | 'doubts' | 'locked';

interface MapNodeProps {
  status: NodeStatus;
  format: string;
  x: number;
  y: number;
  onHover: () => void;
  onHoverEnd: () => void;
  onClick: () => void;
}

const FORMAT_ICONS: Record<string, typeof BookOpen> = {
  PROBLEM: FileText,
  VIDEO: Video,
  ARTICLE: BookOpen,
  BOOK: BookOpen,
};

const STATUS_STYLES: Record<NodeStatus, string> = {
  pending: 'bg-white border-2 border-[hsl(var(--map-path))] text-foreground-muted',
  active: 'bg-white border-[3px] border-brand text-brand shadow-lg shadow-brand/20',
  done: 'bg-success/10 border-2 border-success text-success',
  stuck: 'bg-danger/10 border-2 border-danger text-danger',
  doubts: 'bg-warning/10 border-2 border-warning text-warning',
  locked: 'bg-surface-subtle border-2 border-border text-foreground-subtle opacity-50',
};

const STATUS_OVERLAY_ICON: Partial<Record<NodeStatus, typeof Check>> = {
  done: Check,
  stuck: X,
  doubts: HelpCircle,
  locked: Lock,
};

export function MapNode({ status, format, x, y, onHover, onHoverEnd, onClick }: MapNodeProps) {
  const FormatIcon = FORMAT_ICONS[format] ?? BookOpen;
  const OverlayIcon = STATUS_OVERLAY_ICON[status];
  const isActive = status === 'active';
  const isLocked = status === 'locked';
  const size = isActive ? 80 : 68;

  return (
    <motion.button
      type="button"
      className={`absolute rounded-full flex items-center justify-center ${STATUS_STYLES[status]}`}
      style={{
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
      }}
      whileHover={isLocked ? undefined : { scale: 1.1 }}
      whileTap={isLocked ? undefined : { scale: 0.95 }}
      animate={isActive ? {
        boxShadow: [
          '0 0 0 0 rgba(249,115,22,0.3)',
          '0 0 0 12px rgba(249,115,22,0)',
          '0 0 0 0 rgba(249,115,22,0.3)',
        ],
      } : undefined}
      transition={isActive ? { repeat: Infinity, duration: 2 } : undefined}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      onClick={isLocked ? undefined : onClick}
      disabled={isLocked}
      aria-label={isLocked ? 'Modulo bloqueado' : `Modulo ${format}`}
    >
      {OverlayIcon ? (
        <OverlayIcon className="h-7 w-7" strokeWidth={2.5} />
      ) : (
        <FormatIcon className="h-7 w-7" strokeWidth={1.5} />
      )}
    </motion.button>
  );
}
