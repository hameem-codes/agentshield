import { useRef, useState, useCallback, useEffect } from 'react';

interface UseHoverTooltipOptions {
  content: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  offset?: number;
  showDelay?: number;
  hideDelay?: number;
  containerRef?: React.RefObject<HTMLElement | SVGElement | null>;
}

interface UseHoverTooltipReturn {
  triggerRef: React.RefObject<HTMLElement | SVGElement | null>;
  tooltipRef: React.RefObject<HTMLDivElement | null>;
  isVisible: boolean;
  position: { x: number; y: number };
  showAt: (x: number, y: number) => void;
  hide: () => void;
  triggerProps: {
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onMouseMove: (e: React.MouseEvent) => void;
  };
}

function getTooltipPosition(
  pointerX: number,
  pointerY: number,
  tooltipWidth: number,
  tooltipHeight: number,
  position: UseHoverTooltipOptions['position'],
  offset: number,
  containerRect: DOMRect | null
): { x: number; y: number } {
  const pos = position || 'top';
  let x = pointerX;
  let y = pointerY;

  switch (pos) {
    case 'top':
      x -= tooltipWidth / 2;
      y -= tooltipHeight + offset;
      break;
    case 'bottom':
      x -= tooltipWidth / 2;
      y += offset;
      break;
    case 'left':
      x -= tooltipWidth + offset;
      y -= tooltipHeight / 2;
      break;
    case 'right':
      x += offset;
      y -= tooltipHeight / 2;
      break;
    case 'auto':
    default: {
      const viewportW = window.innerWidth;
      x = pointerX - tooltipWidth / 2;
      y = pointerY - tooltipHeight - offset;
      if (y < 10) y = pointerY + offset;
      if (x < 10) x = 10;
      if (x + tooltipWidth > viewportW - 10) x = viewportW - tooltipWidth - 10;
      if (containerRect) {
        if (y < containerRect.top + 10) y = containerRect.top + 10;
        if (y + tooltipHeight > containerRect.bottom - 10) y = containerRect.bottom - tooltipHeight - 10;
      }
      break;
    }
  }

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  x = Math.max(10, Math.min(x, viewportWidth - tooltipWidth - 10));
  y = Math.max(10, Math.min(y, viewportHeight - tooltipHeight - 10));

  return { x, y };
}

export function useHoverTooltip({
  content,
  position = 'auto',
  offset = 12,
  showDelay = 0,
  hideDelay = 100,
  containerRef,
}: UseHoverTooltipOptions): UseHoverTooltipReturn {
  const triggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const showTimeoutRef = useRef<number | null>(null);
  const hideTimeoutRef = useRef<number | null>(null);
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  const hide = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    hideTimeoutRef.current = window.setTimeout(() => {
      setIsVisible(false);
    }, hideDelay);
  }, [hideDelay]);

  const showAt = useCallback((x: number, y: number) => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    if (showDelay > 0) {
      showTimeoutRef.current = window.setTimeout(() => {
        setIsVisible(true);
        setTooltipPosition({ x, y });
      }, showDelay);
    } else {
      setIsVisible(true);
      setTooltipPosition({ x, y });
    }
  }, [showDelay]);

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const containerRect = containerRef?.current?.getBoundingClientRect() || null;
    const estimatedWidth = 200;
    const estimatedHeight = 80;
    
    const pos = getTooltipPosition(
      e.clientX,
      e.clientY,
      estimatedWidth,
      estimatedHeight,
      position,
      offset,
      containerRect
    );
    
    showAt(pos.x, pos.y);
  }, [containerRef, position, offset, showAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isVisible || !tooltipRef.current) return;
    
    const containerRect = containerRef?.current?.getBoundingClientRect() || null;
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    const pos = getTooltipPosition(
      e.clientX,
      e.clientY,
      tooltipRect.width,
      tooltipRect.height,
      position,
      offset,
      containerRect
    );
    
    setTooltipPosition(pos);
  }, [isVisible, containerRef, position, offset]);

  const handleMouseLeave = useCallback(() => {
    hide();
  }, [hide]);

  useEffect(() => {
    return () => {
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, []);

  return {
    triggerRef,
    tooltipRef,
    isVisible,
    position: tooltipPosition,
    showAt,
    hide,
    triggerProps: {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onMouseMove: handleMouseMove,
    },
  };
}
