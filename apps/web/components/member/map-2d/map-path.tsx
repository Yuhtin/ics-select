'use client';

interface MapPathProps {
  points: Array<{ x: number; y: number }>;
  completedCount: number;
}

function buildPathD(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return '';
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midY = (prev.y + curr.y) / 2;
    parts.push(`C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`);
  }
  return parts.join(' ');
}

export function MapPath({ points, completedCount }: MapPathProps) {
  if (points.length < 2) return null;

  const fullD = buildPathD(points);
  const donePoints = points.slice(0, completedCount + 1);
  const doneD = donePoints.length >= 2 ? buildPathD(donePoints) : '';

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
      <path
        d={fullD}
        fill="none"
        stroke="hsl(var(--map-path))"
        strokeWidth={8}
        strokeLinecap="round"
      />
      {doneD && (
        <path
          d={doneD}
          fill="none"
          stroke="hsl(var(--map-path-done))"
          strokeWidth={8}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      )}
    </svg>
  );
}
