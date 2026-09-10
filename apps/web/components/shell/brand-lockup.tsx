import Image from 'next/image';
import { clsx } from 'clsx';

type BrandLockupSize = 'sm' | 'md' | 'lg' | 'xl';

interface BrandLockupProps {
  size?: BrandLockupSize;
  showWordmark?: boolean;
  className?: string;
  tone?: 'default' | 'inverse';
}

const markSizes: Record<BrandLockupSize, string> = {
  sm: 'h-7 w-7',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
  xl: 'h-14 w-14',
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
  tone = 'default',
}: BrandLockupProps) {
  return (
    <div className={clsx('flex items-center', gaps[size], tone === 'inverse' && 'text-primary-fg', className)}>
      <Image
        src="/brand/academy/ia-mark.svg"
        alt=""
        width={56}
        height={56}
        className={clsx(
          'shrink-0 object-contain',
          markSizes[size],
          tone === 'inverse' ? 'brightness-0 invert' : '[filter:var(--brand-mark-filter)]',
        )}
        aria-hidden="true"
      />
      {showWordmark ? (
        <span className={clsx('font-semibold tracking-[-0.03em]', wordmarkSizes[size])}>
          Academy Fellow
        </span>
      ) : (
        <span className="sr-only">Academy Fellow</span>
      )}
    </div>
  );
}
