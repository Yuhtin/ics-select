'use client';

import { motion } from 'framer-motion';
import { getPlatformKey, PLATFORM_BORDER_CLASS, PLATFORM_LABEL } from './platform-colors';

interface NodeHoverCardProps {
  title: string;
  estimatedMinutes: number;
  format: string;
  url: string | null;
  x: number;
  y: number;
  above: boolean;
}

export function NodeHoverCard({ title, estimatedMinutes, format, url, x, y, above }: NodeHoverCardProps) {
  const platform = getPlatformKey(url, format);
  const borderClass = PLATFORM_BORDER_CLASS[platform];
  const label = PLATFORM_LABEL[platform];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.15 }}
      className={`absolute z-30 pointer-events-none bg-surface border-2 ${borderClass} rounded-xl px-4 py-3 shadow-md w-56`}
      style={{
        left: x - 112,
        top: above ? y - 110 : y + 50,
      }}
    >
      <p className="text-sm font-bold text-foreground truncate">{title}</p>
      <p className="text-xs text-foreground-muted mt-1">
        {label} · ~{estimatedMinutes}min
      </p>
    </motion.div>
  );
}
