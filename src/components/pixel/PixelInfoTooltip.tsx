import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PixelInfoIcon } from './PixelIcons';

export interface PixelInfoTooltipProps {
  title?: string;
  content: string;
  tip?: string;
  size?: number;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export const PixelInfoTooltip: React.FC<PixelInfoTooltipProps> = ({
  title,
  content,
  tip,
  size = 13.5,
  align = 'left',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; arrowOffset: number } | null>(null);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 260;
    const padding = 12;

    let targetLeft: number;
    if (align === 'right') {
      targetLeft = rect.right - tooltipWidth;
    } else if (align === 'center') {
      targetLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
    } else {
      targetLeft = rect.left - 12;
    }

    // Clamp inside viewport
    const clampedLeft = Math.max(
      padding,
      Math.min(targetLeft, window.innerWidth - tooltipWidth - padding)
    );

    // Compute arrow position relative to clamped tooltip left
    const iconCenter = rect.left + rect.width / 2;
    const arrowOffset = Math.max(14, Math.min(iconCenter - clampedLeft, tooltipWidth - 14));

    setCoords({
      top: rect.bottom + 6,
      left: clampedLeft,
      arrowOffset,
    });
  };

  const handleMouseEnter = () => {
    updatePosition();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    setIsOpen(false);
  };

  // Keep position accurate on window resize or scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={title ? `Information about ${title}` : 'More information'}
        aria-expanded={isOpen}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          updatePosition();
          setIsOpen((prev) => !prev);
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        className="text-[#7d77a8] hover:text-[#c4bbf0] focus:outline-none focus:text-[#e0daf8] transition-colors p-0.5 rounded cursor-pointer flex items-center justify-center"
      >
        <PixelInfoIcon size={size} />
      </button>

      {/* Portal Tooltip: rendered directly into document.body to break out of all clip-paths & z-indexes */}
      {isOpen &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              zIndex: 99999,
              width: '260px',
            }}
            className="p-3 bg-[#171434] border-2 border-[#4d408c] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.85),0_0_16px_rgba(109,62,232,0.35)] animate-in fade-in zoom-in-95 duration-150 pointer-events-none select-none"
          >
            {/* Pixel Arrow pointing up to the icon */}
            <div
              style={{ left: `${coords.arrowOffset}px` }}
              className="absolute -top-[7px] -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[7px] border-b-[#4d408c]"
            />
            <div
              style={{ left: `${coords.arrowOffset}px` }}
              className="absolute -top-[4px] -translate-x-1/2 w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[5px] border-b-[#171434]"
            />

            {/* Title Header */}
            {title && (
              <div className="flex items-center gap-1.5 pb-1.5 mb-1.5 border-b border-[#2d255d]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] shadow-[0_0_6px_#a855f7] flex-shrink-0" />
                <h4 className="text-[12px] font-bold text-white tracking-tight font-mono">
                  {title}
                </h4>
              </div>
            )}

            {/* Content Explanation */}
            <p className="text-[11.5px] font-medium text-[#c4bcf0] leading-relaxed">
              {content}
            </p>

            {/* Optional Tip / Subtitle */}
            {tip && (
              <div className="mt-2 pt-1.5 border-t border-[#2d255d]/70 flex items-center gap-1.5 text-[10px] text-[#9a91cc] font-mono">
                <span className="text-[11px]">💡</span>
                <span>{tip}</span>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
