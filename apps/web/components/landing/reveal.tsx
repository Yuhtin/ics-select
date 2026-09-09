'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'span' | 'article';
};

// Minimal IntersectionObserver-driven reveal. Matches the design's
// `.reveal → .reveal.in` pattern (CSS in globals.css handles the animation
// so Server Components can emit the same markup via a class).
export function Reveal({ children, delay = 0, className = '', as = 'div' }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [inView, setInView] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Visible in server markup and for reduced motion, including before hydration.
    if (motion.matches || !('IntersectionObserver' in window)) return;
    setInView(false);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    const onMotionChange = () => {
      if (motion.matches) {
        setInView(true);
        io.disconnect();
      }
    };
    motion.addEventListener('change', onMotionChange);
    return () => {
      io.disconnect();
      motion.removeEventListener('change', onMotionChange);
    };
  }, []);

  const Tag = as;

  return (
    <Tag
      // biome-ignore lint/suspicious/noExplicitAny: Tag union makes ref inference messy
      ref={ref as any}
      className={`reveal ${inView ? 'in' : ''} ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
