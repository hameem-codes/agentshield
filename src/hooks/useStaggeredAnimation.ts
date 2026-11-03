import { useMemo } from 'react';

interface UseStaggeredAnimationOptions {
  itemCount: number;
  baseDelay?: number;
  staggerDelay?: number;
  animationClass?: string;
}

interface StaggeredStyleProps {
  style: React.CSSProperties;
  className: string;
}

/**
 * Hook for generating staggered animation delays for a list of items
 */
export function useStaggeredAnimation({
  itemCount,
  baseDelay = 0,
  staggerDelay = 80,
  animationClass = 'stat-fade-up',
}: UseStaggeredAnimationOptions): StaggeredStyleProps[] {
  return useMemo(() => {
    return Array.from({ length: itemCount }, (_, index) => ({
      style: {
        animationDelay: `${baseDelay + index * staggerDelay}ms`,
      } as React.CSSProperties,
      className: animationClass,
    }));
  }, [itemCount, baseDelay, staggerDelay, animationClass]);
}

/**
 * Hook for generating staggered animation delays with custom delay function
 */
export function useCustomStaggeredAnimation(
  itemCount: number,
  getDelay: (index: number) => number,
  animationClass = 'stat-fade-up'
): StaggeredStyleProps[] {
  return useMemo(() => {
    return Array.from({ length: itemCount }, (_, index) => ({
      style: {
        animationDelay: `${getDelay(index)}ms`,
      } as React.CSSProperties,
      className: animationClass,
    }));
  }, [itemCount, getDelay, animationClass]);
}