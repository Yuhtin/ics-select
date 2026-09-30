'use client';

// Form pieces shared by settings and onboarding. Same values and rules as the
// classic pickers (components/member/*), rebuilt in the BTG look.
import { TRACKS } from '@ics-select/shared';
import type { AvailabilityResponse } from '../../lib/queries/me-settings';
import { Icon } from '../ui';

export const PHONE_REGEX = /^\+\d{8,15}$/;

export const TRACK_INFO: Record<string, { label: string; description: string }> = {
  BIG_TECH: { label: 'Big Tech', description: 'Google, Meta, Amazon, Microsoft. Algoritmos e system design.' },
  CONSULTING_TECH: { label: 'Consultoria Tech', description: 'McKinsey Tech, BCG X. Entrevistas técnicas em formato de case.' },
  COMPETITIVE_PROGRAMMING: { label: 'Programação Competitiva', description: 'ICPC, OBI. Padrões de competição e listas de problemas.' },
  STARTUP: { label: 'Startup', description: 'Engenharia com autonomia. Entregar rápido e raciocinar do zero.' },
  OTHER: { label: 'Outro', description: 'Você alinha os detalhes com o Diretor Educacional.' },
};

// "+55 (11) 98765-4321" for display; E.164 for storage.
export function formatPhone(input: string): string {
  const d = input.replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 2) return `+${d}`;
  if (d.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2)}`;
  const rest = d.slice(4);
  if (rest.length <= 4) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${rest}`;
  const n = rest.length >= 9 ? 5 : 4;
  const tail = rest.slice(n, n + 4);
  return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${rest.slice(0, n)}${tail ? `-${tail}` : ''}`;
}

export function PhoneField({
  value,
  onChange,
  onBlur,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (e164: string) => void;
  onBlur?: () => void;
  invalid: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="btg-field" style={{ maxWidth: 320 }}>
      <input
        className="btg-input btg-mono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        aria-label="WhatsApp"
        aria-invalid={invalid}
        autoFocus={autoFocus}
        value={formatPhone(value)}
        placeholder="+55 (11) 98765-4321"
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '');
          onChange(d ? `+${d}` : '');
        }}
        onBlur={onBlur}
        style={invalid ? { borderColor: 'var(--btg-stuck)' } : undefined}
      />
      {invalid && (
        <span style={{ color: 'var(--btg-stuck)', fontSize: 13 }}>
          Formato inválido. Inclua o código do país, por exemplo +5511999999999.
        </span>
      )}
    </div>
  );
}

export function TrackPicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <div className="btg-mx-choices">
      {TRACKS.map((t) => (
        <button
          key={t}
          type="button"
          className="btg-mx-choice"
          aria-pressed={value === t}
          onClick={() => onChange(t)}
        >
          <span className="btg-mx-choice-title">
            {TRACK_INFO[t].label}
            {value === t && <Icon name="check_circle" style={{ color: 'var(--btg-primary)' }} />}
          </span>
          <span className="btg-mute" style={{ fontSize: 13, lineHeight: '20px' }}>{TRACK_INFO[t].description}</span>
        </button>
      ))}
    </div>
  );
}

export type DayKey =
  | 'mondayMinutes'
  | 'tuesdayMinutes'
  | 'wednesdayMinutes'
  | 'thursdayMinutes'
  | 'fridayMinutes'
  | 'saturdayMinutes'
  | 'sundayMinutes';
export type DayMinutes = Pick<AvailabilityResponse, DayKey>;

export const DAYS: { key: DayKey; short: string }[] = [
  { key: 'mondayMinutes', short: 'Seg' },
  { key: 'tuesdayMinutes', short: 'Ter' },
  { key: 'wednesdayMinutes', short: 'Qua' },
  { key: 'thursdayMinutes', short: 'Qui' },
  { key: 'fridayMinutes', short: 'Sex' },
  { key: 'saturdayMinutes', short: 'Sáb' },
  { key: 'sundayMinutes', short: 'Dom' },
];

// null = no cap (use all of the day's slots).
const CAP_PRESETS: (number | null)[] = [null, 30, 60, 90, 120, 180];

export function DayCaps({ value, onChange }: { value: DayMinutes; onChange: (next: DayMinutes) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {DAYS.map((d) => (
        <div key={d.key} className="btg-mx-dayrow">
          <span className="btg-eyebrow btg-mx-daylabel">{d.short}</span>
          <div className="btg-mx-chips">
            {CAP_PRESETS.map((m) => (
              <button
                key={String(m)}
                type="button"
                className="btg-mx-chip btg-mono"
                aria-pressed={value[d.key] === m}
                aria-label={m === null ? `${d.short}: sem limite` : `${d.short}: ${m} minutos`}
                onClick={() => onChange({ ...value, [d.key]: m })}
              >
                {m === null ? '—' : `${m}m`}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SessionLength({ value, onChange }: { value: number; onChange: (m: number) => void }) {
  return (
    <div className="btg-mx-chips">
      {[15, 30, 45, 60, 90].map((m) => (
        <button
          key={m}
          type="button"
          className="btg-mx-chip btg-mono"
          aria-pressed={value === m}
          onClick={() => onChange(m)}
        >
          {m} min
        </button>
      ))}
    </div>
  );
}

// Fixed colors on purpose: each preview shows its own theme regardless of the active one.
const PREVIEW = {
  light: { bg: '#F5F5F6', surface: '#FFFFFF', border: '#DCDCDF', ink: 'rgba(0,0,0,.96)', mute: 'rgba(0,0,0,.4)', accent: '#195AB4' },
  dark: { bg: '#101010', surface: '#1F2023', border: '#34363B', ink: 'rgba(255,255,255,.96)', mute: 'rgba(255,255,255,.4)', accent: '#3E75C0' },
};

export function ThemePicker({
  value,
  onChange,
}: {
  value: 'light' | 'dark' | undefined;
  onChange: (t: 'light' | 'dark') => void;
}) {
  return (
    <div className="btg-mx-choices">
      {(['light', 'dark'] as const).map((t) => {
        const p = PREVIEW[t];
        return (
          <button key={t} type="button" className="btg-mx-choice" aria-pressed={value === t} onClick={() => onChange(t)}>
            <svg viewBox="0 0 160 90" role="img" aria-label={`Prévia do tema ${t === 'light' ? 'claro' : 'escuro'}`} style={{ width: '100%', borderRadius: 4, display: 'block' }}>
              <rect width="160" height="90" fill={p.bg} />
              <rect width="160" height="14" fill={p.surface} />
              <rect x="8" y="5" width="30" height="4" rx="1" fill={p.ink} />
              <rect x="112" y="5" width="16" height="4" rx="1" fill={p.accent} />
              <rect x="132" y="5" width="16" height="4" rx="1" fill={p.mute} />
              <rect x="8" y="22" width="90" height="60" rx="3" fill={p.surface} stroke={p.border} />
              <rect x="14" y="30" width="50" height="5" rx="1" fill={p.ink} />
              <rect x="14" y="42" width="2" height="10" fill={p.accent} />
              <rect x="20" y="43" width="60" height="3" rx="1" fill={p.ink} />
              <rect x="20" y="49" width="36" height="2" rx="1" fill={p.mute} />
              <rect x="14" y="60" width="2" height="10" fill={p.mute} />
              <rect x="20" y="61" width="54" height="3" rx="1" fill={p.ink} />
              <rect x="20" y="67" width="30" height="2" rx="1" fill={p.mute} />
              <rect x="104" y="22" width="48" height="28" rx="3" fill={p.surface} stroke={p.border} />
              <rect x="110" y="40" width="36" height="4" rx="2" fill={p.accent} />
              <rect x="104" y="56" width="48" height="26" rx="3" fill={p.surface} stroke={p.border} />
            </svg>
            <span className="btg-mx-choice-title">
              {t === 'light' ? 'Claro' : 'Escuro'}
              {value === t && <Icon name="check_circle" style={{ color: 'var(--btg-primary)' }} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
