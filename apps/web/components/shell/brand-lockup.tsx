type BrandLockupSize = 'sm' | 'md' | 'lg' | 'xl';

interface BrandLockupProps {
  size?: BrandLockupSize;
  showWordmark?: boolean;
  className?: string;
}

const markSizes: Record<BrandLockupSize, string> = {
  sm: 'h-7 w-7 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-12 w-12 text-xl',
  xl: 'h-14 w-14 text-2xl',
};

const wordmarkSizes: Record<BrandLockupSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

const gaps: Record<BrandLockupSize, string> = {
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-4',
};

export function BrandLockup({
  size = 'md',
  showWordmark = true,
  className = '',
}: BrandLockupProps) {
  return (
    <div className={`flex items-center ${gaps[size]} ${className}`}>
      <div
        className={`rounded-lg bg-brand text-white flex items-center justify-center font-black tracking-tighter shadow-sm flex-shrink-0 ${markSizes[size]}`}
        aria-hidden="true"
      >
        IS
      </div>
      {showWordmark && (
        <span className={`font-bold tracking-tight text-foreground ${wordmarkSizes[size]}`}>
          ICS Select
        </span>
      )}
    </div>
  );
}
