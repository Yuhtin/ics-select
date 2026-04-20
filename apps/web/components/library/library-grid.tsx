'use client';

import type { AdminLibraryItem } from '../../lib/queries/admin-library';
import { LibraryCard, type Capability } from './library-card';

interface Props {
  items: AdminLibraryItem[];
  capability: Capability;
  onEdit?: (item: AdminLibraryItem) => void;
  onDelete?: (item: AdminLibraryItem) => void;
}

export function LibraryGrid({
  items,
  capability,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div
      className="grid gap-4 py-2"
      style={{
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      }}
    >
      {items.map((item) => (
        <LibraryCard
          key={item.id}
          item={item}
          capability={capability}
          onEdit={onEdit}
          onDelete={onDelete}
          fill
        />
      ))}
    </div>
  );
}
