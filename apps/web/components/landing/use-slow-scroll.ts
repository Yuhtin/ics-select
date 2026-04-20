'use client';

// Drive a slow cinematic scroll to a selector, typically ~7.5s, so the user
// rides past every section on the way. Bypasses CSS scroll-behavior: smooth
// by issuing per-frame instant scrollTo calls.
export function slowScrollTo(target: string, durationMs = 7500): void {
  if (typeof window === 'undefined') return;
  const el = document.querySelector(target);
  if (!el) return;

  const topbarOffset = 88;
  const startY = window.scrollY;
  const endY =
    el.getBoundingClientRect().top + window.scrollY - topbarOffset;
  const distance = endY - startY;
  if (Math.abs(distance) < 2) return;

  // Respect user reduced-motion preference.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo({ top: endY, behavior: 'auto' });
    return;
  }

  const startTime = performance.now();
  const ease = (t: number) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });
  window.addEventListener('keydown', cancel, { once: true });

  function step(now: number) {
    if (cancelled) return;
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / durationMs);
    window.scrollTo({ top: startY + distance * ease(t), behavior: 'auto' });
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
