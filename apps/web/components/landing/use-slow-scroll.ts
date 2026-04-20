'use client';

// Drive a smooth programmatic scroll to a selector with a known, tuned
// duration. Bypasses CSS scroll-behavior: smooth so we control the curve and
// can cancel mid-flight on any user input.
//
// History: the first cut used a 7500ms easeInOutCubic "cinematic" ride so the
// user glided past every section. In practice the ease-in half felt frozen
// (~25% progress in the first 3 seconds) and then the page snapped. We now
// default to a short ease-out so motion is visible on frame 1.
export function slowScrollTo(target: string, durationMs = 1500): void {
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

  // The landing sets `scroll-behavior: smooth` on <html>. In Chrome that CSS
  // intercepts every per-frame `window.scrollTo({ behavior: 'auto' })` and
  // re-queues a smooth animation, so the 60 RAF calls fight each other and
  // scrollY sits at 0 for ~1.3s before snapping to the target. Force the
  // root to auto for the duration of the animation and restore it after.
  const rootEl = document.documentElement;
  const prevScrollBehavior = rootEl.style.scrollBehavior;
  rootEl.style.scrollBehavior = 'auto';

  const startTime = performance.now();
  // easeOutCubic — starts moving immediately, decelerates toward the target.
  const ease = (t: number) => 1 - Math.pow(1 - t, 3);

  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };
  const restore = () => {
    rootEl.style.scrollBehavior = prevScrollBehavior;
  };
  window.addEventListener('wheel', cancel, { passive: true, once: true });
  window.addEventListener('touchstart', cancel, { passive: true, once: true });
  window.addEventListener('keydown', cancel, { once: true });

  function step(now: number) {
    if (cancelled) {
      restore();
      return;
    }
    const elapsed = now - startTime;
    const t = Math.min(1, elapsed / durationMs);
    window.scrollTo({ top: startY + distance * ease(t), behavior: 'auto' });
    if (t < 1) requestAnimationFrame(step);
    else restore();
  }
  requestAnimationFrame(step);
}
