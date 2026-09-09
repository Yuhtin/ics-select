'use client';

export interface GuidedTextResponseProps {
  id: string;
  labelledBy: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  error?: string;
}

export function GuidedTextResponse({ id, labelledBy, value, onChange, placeholder, error }: GuidedTextResponseProps) {
  return (
    <div>
      <textarea
        id={id}
        aria-labelledby={labelledBy}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-h-28 w-full resize-y rounded-none border-0 border-b-2 border-border-strong bg-transparent px-0 pb-3 font-sans text-xl leading-relaxed text-fg caret-primary outline-none placeholder:text-fg-mute focus:border-primary focus:ring-0 sm:text-2xl"
      />
      {error && <p id={`${id}-error`} role="alert" className="mt-2 font-sans text-xs text-danger">{error}</p>}
    </div>
  );
}
