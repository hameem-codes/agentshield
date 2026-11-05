import React, { useEffect, useRef, useState } from 'react';
import { useIntersectionObserver } from '../../hooks/useIntersectionObserver';
import { useStaggeredAnimation } from '../../hooks/useStaggeredAnimation';

interface AnimatedChartWrapperProps {
  children: React.ReactNode;
  /** Number of series/lines in the chart */
  seriesCount?: number;
  /** Number of data points per series */
  pointCount?: number;
  /** Chart identifier for animation coordination */
  chartId: string;
  /** Trigger animation on mount (default: true) */
  animateOnMount?: boolean;
  /** Trigger animation when scrolled into view */
  animateOnScroll?: boolean;
  /** Custom className */
  className?: string;
  /** Callback when animation starts */
  onAnimationStart?: () => void;
  /** Callback when animation completes */
  onAnimationComplete?: () => void;
}

export const AnimatedChartWrapper: React.FC<AnimatedChartWrapperProps> = ({
  children,
  seriesCount = 1,
  pointCount = 7,
  chartId,
  animateOnMount: _animateOnMount = true,
  animateOnScroll = true,
  className = '',
  onAnimationStart,
  onAnimationComplete,
}) => {
  const [isVisible, setIsVisible] = useState(!animateOnScroll);
  const [hasAnimated, setHasAnimated] = useState(false);
  const animationTriggeredRef = useRef(false);

  const { ref } = useIntersectionObserver({
    threshold: 0.15,
    rootMargin: '50px',
    triggerOnce: true,
    onIntersect: (visible) => {
      if (visible && animateOnScroll && !hasAnimated) {
        setIsVisible(true);
      }
    },
  });

  // Staggered animation delays for series
  const seriesStyles = useStaggeredAnimation({
    itemCount: seriesCount,
    baseDelay: 100,
    staggerDelay: 120,
    animationClass: 'chart-line',
  });

  // Staggered animation delays for points
  const pointStyles = useStaggeredAnimation({
    itemCount: pointCount,
    baseDelay: 350,
    staggerDelay: 80,
    animationClass: 'chart-point',
  });

  // Trigger animation when visible
  useEffect(() => {
    if (isVisible && !hasAnimated && !animationTriggeredRef.current) {
      animationTriggeredRef.current = true;
      setHasAnimated(true);
      onAnimationStart?.();
      
      const totalDuration = 1200 + 250 + 350 + pointCount * 80;
      setTimeout(() => {
        onAnimationComplete?.();
      }, totalDuration);
    }
  }, [isVisible, hasAnimated, pointCount, onAnimationStart, onAnimationComplete]);

  // Clone children and inject animation props
  const enhancedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    
    const childProps = (child.props || {}) as Record<string, unknown>;
    return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, {
      ...childProps,
      $animated: true,
      $seriesStyles: seriesStyles,
      $pointStyles: pointStyles,
      $chartId: chartId,
      $isVisible: isVisible,
      ref: ref,
    });
  });

  return (
    <div className={`relative ${className}`}>
      {enhancedChildren}
    </div>
  );
};
