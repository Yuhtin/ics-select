import { clsx } from 'clsx';

type BarColor = 'ink-soft' | 'stuck' | 'done-easy' | 'paper-warm';

const BAR_BG_BY_COLOR: Record<BarColor, string> = {
  'ink-soft':   'bg-ink-soft',
  'stuck':      'bg-outcome-stuck',
  'done-easy':  'bg-outcome-done-easy',
  'paper-warm': 'bg-paper-warm',
};

type Props = {
  label: string;
  value: string;
  fraction?: string;
  delta?: { kind: 'up' | 'down' | 'mute'; text: string };
  bars?: number[];
  barColors?: BarColor[];
};

export function KpiCell({ label, value, fraction, delta, bars, barColors }: Props) {
  return (
    <div className="px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
        {label}
      </p>
      <p className="font-serif-tool tabular-nums text-ink text-[30px] mt-1.5 leading-none">
        {value}
        {fraction && <span className="text-ink-faint text-base"> {fraction}</span>}
      </p>
      {bars && bars.length > 0 && (
        <div className="flex items-end gap-0.5 mt-2 h-3">
          {bars.map((b, i) => {
            const max = Math.max(...bars, 1);
            const c: BarColor = barColors?.[i] ?? 'ink-soft';
            return (
              <span
                key={i}
                className={clsx('flex-1 rounded-sm', BAR_BG_BY_COLOR[c])}
                style={{ height: `${Math.max(8, (b / max) * 100)}%` }}
              />
            );
          })}
        </div>
      )}
      {delta && (
        <p
          className={clsx(
            'mt-2 font-mono text-[11px]',
            delta.kind === 'down' ? 'text-outcome-stuck' : delta.kind === 'up' ? 'text-outcome-done-easy' : 'text-ink-faint',
          )}
        >
          {delta.text}
        </p>
      )}
    </div>
  );
}
