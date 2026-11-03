import React from 'react';

interface LegendItem {
  label: string;
  color: string;
  enabled: boolean;
  value?: number;
  percentage?: number;
  onToggle: (label: string) => void;
}

interface InteractiveLegendProps {
  items: LegendItem[];
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  showValues?: boolean;
  showPercentages?: boolean;
  itemClassName?: string;
}

export const InteractiveLegend: React.FC<InteractiveLegendProps> = ({
  items,
  orientation = 'horizontal',
  className = '',
  showValues = false,
  showPercentages = false,
  itemClassName = '',
}) => (
  <div
    className={`flex flex-wrap gap-3 ${orientation === 'vertical' ? 'flex-col' : 'flex-row'} items-center ${className}`}
    role="group"
    aria-label="Chart legend"
  >
    {items.map((item, index) => (
      <button
        key={item.label}
        onClick={() => item.onToggle(item.label)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all duration-150 ${itemClassName} ${
          item.enabled
            ? 'bg-[#221f45] border border-[#39316d] hover:border-[#52479e]'
            : 'bg-[#1a1738] border border-[#2d2855] opacity-50 hover:opacity-75'
        }`}
        aria-pressed={item.enabled}
        style={{ animationDelay: `${index * 60}ms` }}
      >
        <span
          className={`w-2 h-2 rounded-xs flex-shrink-0 transition-all duration-150 ${
            item.enabled ? 'opacity-100 scale-100' : 'opacity-30 scale-75'
          }`}
          style={{ backgroundColor: item.color }}
        />
        <span className={`text-[11px] font-medium ${item.enabled ? 'text-white' : 'text-[#7d77a8]'}`}>
          {item.label}
        </span>
        {(showValues || showPercentages) && (
          <span className="text-[10px] font-semibold text-[#9e98c9] ml-1">
            {showPercentages && item.percentage !== undefined
              ? `${item.percentage.toFixed(1)}%`
              : showValues && item.value !== undefined
              ? item.value.toLocaleString()
              : ''}
          </span>
        )}
      </button>
    ))}
  </div>
);

/**
 * SeriesToggle - Compact toggle for showing/hiding chart series
 */
interface SeriesToggleProps {
  series: { label: string; color: string; enabled: boolean }[];
  onToggle: (label: string) => void;
  className?: string;
}

export const SeriesToggle: React.FC<SeriesToggleProps> = ({ series, onToggle, className = '' }) => (
  <div className={`flex items-center gap-1.5 flex-wrap ${className}`} role="group" aria-label="Series visibility">
    {series.map((s, i) => (
      <label
        key={s.label}
        className="flex items-center gap-1 cursor-pointer select-none"
        style={{ animationDelay: `${i * 50}ms` }}
      >
        <input
          type="checkbox"
          checked={s.enabled}
          onChange={() => onToggle(s.label)}
          className="w-3.5 h-3.5 accent-[#6d3ee8] rounded-xs border-[#3f387c] bg-[#181635] focus:ring-1 focus:ring-[#6d3ee8]"
          aria-label={`Toggle ${s.label} series`}
        />
        <span
          className="w-2 h-2 rounded-xs flex-shrink-0"
          style={{ backgroundColor: s.color, opacity: s.enabled ? 1 : 0.3 }}
        />
        <span className={`text-[11px] font-medium ${s.enabled ? 'text-white' : 'text-[#7d77a8]'}`}>
          {s.label}
        </span>
      </label>
    ))}
  </div>
);
