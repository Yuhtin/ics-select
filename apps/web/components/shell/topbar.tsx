'use client';

import { Bell, Menu, Search } from 'lucide-react';

interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps) {
  return (
    <header className="sticky top-0 z-20 h-14 bg-background/80 backdrop-blur-md border-b border-border lg:ml-60">
      <div className="h-full px-4 sm:px-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Abrir menu"
          className="h-9 w-9 flex items-center justify-center rounded-md text-foreground-muted hover:bg-surface-subtle transition-colors lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex-1" />

        <button
          type="button"
          disabled
          aria-label="Buscar (em breve)"
          className="hidden sm:flex h-9 px-3 items-center gap-2 text-xs text-foreground-subtle border border-border rounded-md disabled:opacity-60 cursor-default"
        >
          <Search className="h-3.5 w-3.5" aria-hidden="true" />
          Buscar
          <kbd className="ml-2 text-[10px] font-mono">⌘K</kbd>
        </button>
        <button
          type="button"
          disabled
          aria-label="Notificações"
          className="h-9 w-9 flex items-center justify-center rounded-md text-foreground-muted disabled:opacity-60 cursor-default"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
