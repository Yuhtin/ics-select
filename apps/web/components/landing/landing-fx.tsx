'use client';

import { useEffect, useRef } from 'react';

/**
 * Tiny atmospheric effects for the landing page:
 *  - A 2px scroll-progress bar pinned to the top.
 *  - A cursor-tracking dot with mix-blend-difference that scales up over
 *    interactive elements (matches the reference prototype).
 *
 * Kept together so the landing page only has to mount one component.
 */
export function LandingFx() {
  const progressRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll progress
    const prog = progressRef.current;
    const onScroll = () => {
      if (!prog) return;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = window.scrollY / Math.max(max, 1);
      prog.style.transform = `scaleX(${p})`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // Cursor dot
    const cursor = cursorRef.current;
    let cx = 0;
    let cy = 0;
    let tx = 0;
    let ty = 0;
    let raf = 0;

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      if (cursor) cursor.style.opacity = '1';
    };
    const onLeave = () => {
      if (cursor) cursor.style.opacity = '0';
    };
    const loop = () => {
      if (cursor) {
        cx += (tx - cx) * 0.18;
        cy += (ty - cy) * 0.18;
        cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    raf = requestAnimationFrame(loop);

    // Enlarge on interactive elements
    const selector = 'a, button, [data-cursor-target]';
    const onEnter = () => {
      if (!cursor) return;
      cursor.style.width = '32px';
      cursor.style.height = '32px';
      cursor.style.background = 'hsl(var(--primary))';
    };
    const onExit = () => {
      if (!cursor) return;
      cursor.style.width = '8px';
      cursor.style.height = '8px';
      cursor.style.background = 'hsl(var(--fg))';
    };
    const targets = Array.from(document.querySelectorAll<HTMLElement>(selector));
    for (const el of targets) {
      el.addEventListener('mouseenter', onEnter);
      el.addEventListener('mouseleave', onExit);
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      cancelAnimationFrame(raf);
      for (const el of targets) {
        el.removeEventListener('mouseenter', onEnter);
        el.removeEventListener('mouseleave', onExit);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={progressRef}
        aria-hidden
        className="fixed top-0 left-0 right-0 z-[100]"
        style={{
          height: 2,
          background: 'hsl(var(--primary))',
          transformOrigin: 'left',
          transform: 'scaleX(0)',
          transition: 'transform 100ms linear',
        }}
      />
      <div ref={cursorRef} aria-hidden className="cursor-dot" />
    </>
  );
}
