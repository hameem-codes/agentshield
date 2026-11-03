import React from 'react';

interface ChartTooltipProps {
  isVisible: boolean;
  position: { x: number; y: number };
  content: React.ReactNode;
  className?: string;
  pointerPosition?: { x: number; y: number };
  onClose?: () => void;
}

export const ChartTooltip: React.FC<ChartTooltipProps> = ({
  isVisible,
  position,
  content,
  className = '',
}) => {
  if (!isVisible) return null;

  return (
    <div
      className={`fixed z-50 pointer-events-none animate-tooltip-in ${className}`}
      style={{
        left: position.x,
        top: position.y,
        transform: 'translate(0, 0)',
      }}
      role="tooltip"
    >
      <div className="relative">
        {/* Tooltip content with pixel styling */}
        <div className="bg-[#181635] border border-[#3f387c] pixel-corners p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)] min-w-[160px] max-w-[320px]">
          {content}
        </div>
        
        {/* Pixel-style pointer arrow */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent"
          style={{
            bottom: '-4px',
            borderTopColor: '#3f387c',
          }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 w-0 h-0 border-l-1.5 border-r-1.5 border-t-1.5 border-transparent"
          style={{
            bottom: '-3px',
            borderTopColor: '#181635',
          }}
        />
      </div>
    </div>
  );
};

/**
 * ChartTooltipContent - Pre-styled tooltip content for chart data points
 */
interface ChartTooltipContentProps {
  title: string;
  value: string | number;
  series: { label: string; value: string | number; color: string }[];
  timestamp?: string;
  trend?: { value: number; isPositive: boolean };
}

export const ChartTooltipContent: React.FC<ChartTooltipContentProps> = ({
  title,
  value,
  series,
  timestamp,
  trend,
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-white font-bold text-[12px]">{title}</span>
      {timestamp && <span className="text-[#8c85bd] text-[10px] font-medium">{timestamp}</span>}
    </div>
    
    <div className="text-[20px] font-bold text-white tracking-tight">
      {typeof value === 'number' ? value.toLocaleString() : value}
      {trend && (
        <span
          className={`ml-2 text-[11px] font-bold ${trend.isPositive ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
        >
          {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
        </span>
      )}
    </div>

    <div className="space-y-1.5 pt-1 border-t border-[#25204c]">
      {series.map((s, i) => (
        <div key={i} className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-xs flex-shrink-0"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-[#a49ecc]">{s.label}</span>
          </div>
          <span className="text-white font-semibold tabular-nums">
            {typeof s.value === 'number' ? s.value.toLocaleString() : s.value}
          </span>
        </div>
      ))}
    </div>
  </div>
);
