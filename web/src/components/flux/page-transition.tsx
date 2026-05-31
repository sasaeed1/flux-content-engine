'use client';

/**
 * PageTransition — cinematic route cross-fade.
 *
 * Wraps the app's main content; on navigation the outgoing view fades + scales
 * to 0.99 and the incoming view rises 8px + fades over ~280ms. Surfaces feel
 * connected (Home↔Forge↔Library), not like instant hard swaps. Keyed on
 * pathname so AnimatePresence detects the change.
 *
 * Respects prefers-reduced-motion (the global CSS kill-switch flattens the
 * durations; we also short-circuit the transform here).
 */
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.995 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.995 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
