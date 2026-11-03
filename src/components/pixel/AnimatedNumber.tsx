import React, { useEffect, useRef, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  /** Number of decimal places to display. Defaults to 0. */
  decimals?: number;
  /** Animation duration in milliseconds. Defaults to 900. */
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** Set to false to render the value immediately without animating. */
  animate?: boolean;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts a stat from its previous value up to the target value.
 * Uses requestAnimationFrame and respects prefers-reduced-motion.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  duration = 240,
  prefix = '',
  suffix = '',
  className = '',
  animate = true,
}) => {
  const shouldAnimate = animate && !prefersReducedMotion;

  const [display, setDisplay] = useState(value);
  const displayRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!shouldAnimate) { setDisplay(value); displayRef.current = value; return; }

    const from = displayRef.current;
    if (from === value) return;
    const to = value;
    let startTime: number | null = null;

    const tick = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const next = from + (to - from) * easeOutCubic(progress);

      displayRef.current = next;
      setDisplay(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = to;
        setDisplay(to);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value, duration, shouldAnimate]);

  const displayValue = shouldAnimate ? display : value;
  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.round(displayValue).toLocaleString();

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};
