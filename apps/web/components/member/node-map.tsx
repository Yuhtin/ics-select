'use client';

import { useState, useMemo, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MapPath } from './map-path';
import { MapNode } from './map-node';
import { MapDecorations } from './map-decorations';
import { NodeHoverCard } from './node-hover-card';
import { NodeExpandedCard } from './node-expanded-card';

type NodeStatus = 'pending' | 'active' | 'done' | 'stuck' | 'doubts' | 'locked';

interface PlanItem {
  id: string;
  status: 'PENDING' | 'DONE';
  stuck: boolean;
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  order: number;
  libraryItem: {
    id: string;
    title: string;
    description?: string | null;
    estimatedMinutes: number;
    url: string | null;
    format: string;
  };
}

interface NodeMapProps {
  planId: string;
  items: PlanItem[];
}

const MAP_WIDTH = 600;
const NODE_SPACING_Y = 140;
const PADDING_TOP = 80;
const AMPLITUDE = 160;

function computeNodeStatus(item: PlanItem, index: number, items: PlanItem[]): NodeStatus {
  if (item.status === 'DONE') {
    if (item.completionStatus === 'STUCK' || item.stuck) return 'stuck';
    if (item.completionStatus === 'DOUBTS') return 'doubts';
    return 'done';
  }
  const firstPending = items.findIndex((i) => i.status === 'PENDING');
  if (index === firstPending) return 'active';
  return 'pending';
}

export function NodeMap({ planId, items }: NodeMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const orderedItems = useMemo(
    () => [...items].sort((a, b) => a.order - b.order).reverse(),
    [items],
  );

  const positions = useMemo(() => {
    return orderedItems.map((_, i) => {
      const y = PADDING_TOP + i * NODE_SPACING_Y;
      const x = MAP_WIDTH / 2 + Math.sin((i * Math.PI) / 2) * AMPLITUDE;
      return { x, y };
    });
  }, [orderedItems]);

  const totalHeight = PADDING_TOP + orderedItems.length * NODE_SPACING_Y + 80;
  const completedCount = orderedItems.filter((i) => i.status === 'DONE').length;

  const hoveredItem = hoveredId ? orderedItems.find((i) => i.id === hoveredId) : null;
  const hoveredIdx = hoveredId ? orderedItems.findIndex((i) => i.id === hoveredId) : -1;
  const hoveredPos = hoveredIdx >= 0 ? positions[hoveredIdx] : null;

  const expandedItem = expandedId ? orderedItems.find((i) => i.id === expandedId) : null;

  const handleClose = useCallback(() => setExpandedId(null), []);

  return (
    <div
      ref={containerRef}
      className="relative w-full max-w-[600px] mx-auto"
      style={{ height: totalHeight }}
    >
      <MapDecorations nodePositions={positions} mapWidth={MAP_WIDTH} />
      <MapPath points={positions} completedCount={completedCount} />

      {orderedItems.map((item, i) => (
        <MapNode
          key={item.id}
          status={computeNodeStatus(item, i, orderedItems)}
          format={item.libraryItem.format}
          x={positions[i].x}
          y={positions[i].y}
          onHover={() => !expandedId && setHoveredId(item.id)}
          onHoverEnd={() => setHoveredId(null)}
          onClick={() => { setHoveredId(null); setExpandedId(item.id); }}
        />
      ))}

      <AnimatePresence>
        {hoveredItem && hoveredPos && !expandedId && (
          <NodeHoverCard
            key="hover"
            title={hoveredItem.libraryItem.title}
            estimatedMinutes={hoveredItem.libraryItem.estimatedMinutes}
            format={hoveredItem.libraryItem.format}
            url={hoveredItem.libraryItem.url}
            x={hoveredPos.x}
            y={hoveredPos.y}
            above={hoveredPos.y > 200}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {expandedItem && (
          <NodeExpandedCard
            key="expanded"
            planId={planId}
            itemId={expandedItem.id}
            title={expandedItem.libraryItem.title}
            description={expandedItem.libraryItem.description}
            estimatedMinutes={expandedItem.libraryItem.estimatedMinutes}
            format={expandedItem.libraryItem.format}
            url={expandedItem.libraryItem.url}
            status={expandedItem.status}
            completionStatus={expandedItem.completionStatus}
            feedback={expandedItem.feedback}
            onClose={handleClose}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
