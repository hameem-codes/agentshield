import React from 'react';
import { PixelSlidersIcon, PixelInfoIcon } from './pixel/PixelIcons';
import { PixelCard } from './pixel/PixelCard';
import { AnimatedNumber } from './pixel/AnimatedNumber';

export const RiskOverview: React.FC = () => {
  const tiers = [
    {
      name: 'Critical',
      range: '(81–100)',
      percentage: 3.4,
      count: 132,
      color: '#ef4444',
    },
    {
      name: 'High',
      range: '(61–80)',
      percentage: 8.9,
      count: 341,
      color: '#f97316',
    },
    {
      name: 'Medium',
      range: '(31–60)',
      percentage: 22.8,
      count: 876,
      color: '#eab308',
    },
    {
      name: 'Low',
      range: '(0–30)',
      percentage: 64.9,
      count: 2493,
      color: '#22c55e',
    },
  ];

  return (
    <PixelCard className="h-full flex-1" innerClassName="p-3.5 justify-between h-full">
      {/* Header */}
      <div className="flex items-center gap-1.5 pb-2 border-b border-[#25204c]">
        <div className="flex items-center justify-center text-[#c084fc]">
          <PixelSlidersIcon size={16} />
        </div>
        <h3 className="text-[13.5px] font-bold text-white tracking-tight">
          Risk Overview
        </h3>
        <button
          title="Distribution of actions scored by runtime anomaly risk engine"
          className="text-[#7d77a8] hover:text-[#c4bbf0] transition-colors ml-0.5"
        >
          <PixelInfoIcon size={13} />
        </button>
      </div>

      {/* Rows - tightly spaced, balanced columns */}
      <div className="flex flex-col justify-between gap-2 my-auto py-1.5">
        {tiers.map((tier, index) => (
          <div
            key={tier.name}
            className="py-1 px-1.5 rounded-md hover:bg-[#201d44] transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-medium">
              {/* Color indicator + Name + Range */}
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-xs flex-shrink-0"
                  style={{ backgroundColor: tier.color }}
                />
                <span className="text-white font-semibold text-[13px]">
                  {tier.name}
                </span>
                <span className="text-[#847ea8] text-[12px]">
                  {tier.range}
                </span>
              </div>

              {/* Percentage & Count */}
              <div className="flex items-center gap-4">
                <span className="text-white text-[12.5px] font-semibold tabular-nums min-w-[42px] text-right">
                  <AnimatedNumber value={tier.percentage} decimals={1} suffix="%" />
                </span>
                <span className="text-[#847ea8] text-[12px] tabular-nums min-w-[38px] text-right">
                  <AnimatedNumber value={tier.count} />
                </span>
              </div>
            </div>

            {/* Animated distribution bar */}
            <div className="mt-1.5 h-1 rounded-sm bg-[#211d47] overflow-hidden">
              <div
                className="h-full rounded-sm bar-grow"
                style={{
                  width: `${tier.percentage}%`,
                  backgroundColor: tier.color,
                  animationDelay: `${index * 90}ms`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </PixelCard>
  );
};
