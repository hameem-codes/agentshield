import { useRef, useCallback, useEffect, useState } from 'react';

interface UseChartAnimationOptions {
  chartId?: string;
  seriesCount: number;
  pointCount: number;
  enabled?: boolean;
}

interface RefHolder<T> {
  current: T | null;
}

interface UseChartAnimationReturn {
  lineRefs: RefHolder<SVGPathElement>[];
  areaRef: RefHolder<SVGPathElement>;
  pointRefs: RefHolder<SVGRectElement>[][];
  triggerAnimation: () => void;
  resetAnimation: () => void;
  isAnimating: boolean;
}

const STAGGER_DELAY = 80;
const LINE_DURATION = 1200;
const AREA_DELAY = 250;
const POINT_DELAY_BASE = 350;

export function useChartAnimation({
  chartId: _chartId,
  seriesCount,
  pointCount,
  enabled = true,
}: UseChartAnimationOptions): UseChartAnimationReturn {
  const lineRefs = useRef<RefHolder<SVGPathElement>[]>(
    Array.from({ length: seriesCount }, () => ({ current: null }))
  );
  const areaRef = useRef<RefHolder<SVGPathElement>>({ current: null });
  const pointRefs = useRef<RefHolder<SVGRectElement>[][]>(
    Array.from({ length: seriesCount }, () =>
      Array.from({ length: pointCount }, () => ({ current: null }))
    )
  );
  const isAnimatingRef = useRef(false);
  const animationTriggerRef = useRef(0);

  const triggerAnimation = useCallback(() => {
    if (!enabled) return;
    animationTriggerRef.current += 1;
    isAnimatingRef.current = true;
    
    // Reset animation by forcing reflow
    lineRefs.current.forEach((ref) => {
      if (ref.current) {
        ref.current.style.animation = 'none';
        void ref.current.getBoundingClientRect(); // Force reflow
        ref.current.style.animation = '';
      }
    });
    
    if (areaRef.current.current) {
      areaRef.current.current.style.animation = 'none';
      void areaRef.current.current.getBoundingClientRect();
      areaRef.current.current.style.animation = '';
    }
    
    pointRefs.current.forEach((seriesRefs) => {
      seriesRefs.forEach((pointRef) => {
        if (pointRef.current) {
          pointRef.current.style.animation = 'none';
          void pointRef.current.getBoundingClientRect();
          pointRef.current.style.animation = '';
        }
      });
    });

    // Auto-reset animating flag after max duration
    const maxDuration = LINE_DURATION + AREA_DELAY + POINT_DELAY_BASE + pointCount * STAGGER_DELAY;
    setTimeout(() => {
      isAnimatingRef.current = false;
    }, maxDuration);
  }, [enabled, pointCount]);

  const resetAnimation = useCallback(() => {
    lineRefs.current.forEach((ref) => {
      if (ref.current) {
        ref.current.style.animation = 'none';
      }
    });
    if (areaRef.current.current) {
      areaRef.current.current.style.animation = 'none';
    }
    pointRefs.current.forEach((seriesRefs) => {
      seriesRefs.forEach((pointRef) => {
        if (pointRef.current) {
          pointRef.current.style.animation = 'none';
        }
      });
    });
    isAnimatingRef.current = false;
  }, []);

  // Trigger on mount
  useEffect(() => {
    if (enabled) {
      const timer = setTimeout(triggerAnimation, 100);
      return () => clearTimeout(timer);
    }
  }, [enabled, triggerAnimation]);

  return {
    lineRefs: lineRefs.current,
    areaRef: areaRef.current,
    pointRefs: pointRefs.current,
    triggerAnimation,
    resetAnimation,
    isAnimating: isAnimatingRef.current,
  };
}

/**
 * Hook for coordinating chart animations across multiple charts
 */
export function useChartAnimationCoordinator(chartIds: string[]) {
  const [completedCharts, setCompletedCharts] = useState<Set<string>>(new Set());
  const [allComplete, setAllComplete] = useState(false);

  const registerCompletion = (chartId: string) => {
    setCompletedCharts((prev) => {
      const next = new Set(prev);
      next.add(chartId);
      if (next.size === chartIds.length) {
        setAllComplete(true);
      }
      return next;
    });
  };

  const reset = () => {
    setCompletedCharts(new Set());
    setAllComplete(false);
  };

  return { completedCharts, allComplete, registerCompletion, reset };
}
