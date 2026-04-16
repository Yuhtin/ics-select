'use client';

interface DecorationProps {
  x: number;
  y: number;
}

function Star({ x, y }: DecorationProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      className="absolute text-warning/40"
      style={{ left: x, top: y }}
    >
      <path d="M10 1l2.5 6.5H19l-5.3 4 2 6.5L10 14l-5.7 4 2-6.5L1 7.5h6.5z" fill="currentColor" />
    </svg>
  );
}

function Flag({ x, y }: DecorationProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className="absolute text-brand/30"
      style={{ left: x, top: y }}
    >
      <path d="M4 2v20M4 4h12l-3 4 3 4H4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cloud({ x, y }: DecorationProps) {
  return (
    <svg
      width="48"
      height="28"
      viewBox="0 0 48 28"
      className="absolute text-foreground/5"
      style={{ left: x, top: y }}
    >
      <ellipse cx="24" cy="18" rx="16" ry="10" fill="currentColor" />
      <ellipse cx="16" cy="14" rx="12" ry="9" fill="currentColor" />
      <ellipse cx="32" cy="14" rx="10" ry="8" fill="currentColor" />
    </svg>
  );
}

interface MapDecorationsProps {
  nodePositions: Array<{ x: number; y: number }>;
  mapWidth: number;
}

export function MapDecorations({ nodePositions, mapWidth }: MapDecorationsProps) {
  const decorations: Array<{ type: 'star' | 'flag' | 'cloud'; x: number; y: number }> = [];

  nodePositions.forEach((pos, i) => {
    if (i % 2 === 0) {
      decorations.push({
        type: 'star',
        x: pos.x > mapWidth / 2 ? pos.x - 80 : pos.x + 60,
        y: pos.y - 15,
      });
    }
    if (i % 3 === 0) {
      decorations.push({
        type: 'flag',
        x: pos.x > mapWidth / 2 ? pos.x + 55 : pos.x - 70,
        y: pos.y + 10,
      });
    }
    if (i % 4 === 1) {
      decorations.push({
        type: 'cloud',
        x: pos.x > mapWidth / 2 ? 20 : mapWidth - 80,
        y: pos.y - 40,
      });
    }
  });

  return (
    <>
      {decorations.map((d, i) => {
        const key = `${d.type}-${i}`;
        switch (d.type) {
          case 'star': return <Star key={key} x={d.x} y={d.y} />;
          case 'flag': return <Flag key={key} x={d.x} y={d.y} />;
          case 'cloud': return <Cloud key={key} x={d.x} y={d.y} />;
        }
      })}
    </>
  );
}
