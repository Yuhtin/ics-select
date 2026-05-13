'use client';

type Member = { userId: string; name: string; pictureUrl: string | null };
type Topic = { topicId: string; slug: string; label: string; order: number };
type Cell = { userId: string; topicId: string; itemsDone: number; hasStuckOrDoubts: boolean };

export type CohortKnowledgeGridProps = {
  members: Member[];
  topics: Topic[];
  cells: Cell[];
  variant?: 'thermal' | 'inverted';
  showTotals?: boolean;
  onMemberClick?: (userId: string) => void;
  onCellClick?: (userId: string, topicId: string) => void;
};

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function CohortKnowledgeGrid({
  members,
  topics,
  cells,
  variant = 'thermal',
  showTotals = true,
  onMemberClick,
  onCellClick,
}: CohortKnowledgeGridProps) {
  const cellMap = new Map<string, Cell>();
  for (const c of cells) cellMap.set(`${c.userId}|${c.topicId}`, c);

  const inverted = variant === 'inverted';
  const cellColor = (c: Cell | undefined) => {
    if (!c || c.itemsDone === 0) return inverted ? 'text-white/30' : 'text-ink-faint';
    if (c.hasStuckOrDoubts) return 'text-outcome-stuck';
    if (c.itemsDone === 1) return inverted ? 'text-white/70' : 'text-ink-soft';
    return inverted ? 'text-white' : 'text-ink';
  };
  const cellGlyph = (c: Cell | undefined) => {
    if (!c || c.itemsDone === 0) return '·';
    if (c.itemsDone === 1) return '●';
    return '●●';
  };

  if (members.length === 0) {
    return (
      <div className={`font-mono text-xs ${inverted ? 'text-white/60' : 'text-ink-mute'}`}>
        No members in this cycle.
      </div>
    );
  }
  if (topics.length === 0) {
    return (
      <div className={`font-mono text-xs ${inverted ? 'text-white/60' : 'text-ink-mute'}`}>
        Nothing studied yet.
      </div>
    );
  }

  const totals = topics.map((t) =>
    members.reduce(
      (s, m) => s + ((cellMap.get(`${m.userId}|${t.topicId}`)?.itemsDone ?? 0) > 0 ? 1 : 0),
      0,
    ),
  );

  return (
    <div className="overflow-x-auto">
      <table className="font-mono text-xs">
        <thead>
          <tr>
            <th className="w-[180px]" />
            {topics.map((t, i) => (
              <th
                key={t.topicId}
                className={`px-2 pb-2 align-bottom ${
                  i > 0 && i % 4 === 0
                    ? inverted
                      ? 'border-l border-white/20'
                      : 'border-l border-rule'
                    : ''
                }`}
              >
                <div
                  className={`origin-bottom-left -rotate-45 whitespace-nowrap text-[10px] uppercase tracking-label ${
                    inverted ? 'text-white/70' : 'text-ink-soft'
                  }`}
                  title={t.label}
                >
                  {truncate(t.label, 14)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map((m) => (
            <tr
              key={m.userId}
              className={inverted ? 'hover:bg-white/5' : 'hover:bg-paper-warm'}
            >
              <td
                className={`pr-3 ${
                  onMemberClick ? 'cursor-pointer underline-offset-2 hover:underline' : ''
                }`}
                onClick={onMemberClick ? () => onMemberClick(m.userId) : undefined}
                title={m.name}
              >
                {truncate(m.name, 22)}
              </td>
              {topics.map((t, i) => {
                const c = cellMap.get(`${m.userId}|${t.topicId}`);
                return (
                  <td
                    key={t.topicId}
                    className={`px-2 text-center ${cellColor(c)} ${
                      i > 0 && i % 4 === 0
                        ? inverted
                          ? 'border-l border-white/20'
                          : 'border-l border-rule'
                        : ''
                    } ${onCellClick ? 'cursor-pointer' : ''}`}
                    onClick={onCellClick ? () => onCellClick(m.userId, t.topicId) : undefined}
                    title={c?.hasStuckOrDoubts ? 'has stuck or doubts in this topic' : undefined}
                  >
                    {cellGlyph(c)}
                  </td>
                );
              })}
            </tr>
          ))}
          {showTotals && (
            <tr
              className={inverted ? 'border-t border-white/20' : 'border-t border-rule'}
            >
              <td
                className={`pt-2 pr-3 uppercase tracking-label text-[10px] ${
                  inverted ? 'text-white/60' : 'text-ink-mute'
                }`}
              >
                Total
              </td>
              {totals.map((n, i) => (
                <td
                  key={i}
                  className={`pt-2 px-2 text-center ${
                    inverted ? 'text-white/80' : 'text-ink-soft'
                  } ${
                    i > 0 && i % 4 === 0
                      ? inverted
                        ? 'border-l border-white/20'
                        : 'border-l border-rule'
                      : ''
                  }`}
                >
                  {n}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
