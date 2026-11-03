import React from 'react';
import { PixelSlidersIcon } from './pixel/PixelIcons';
import { PixelInfoTooltip } from './pixel/PixelInfoTooltip';
import { PixelCard } from './pixel/PixelCard';
import { AnimatedNumber } from './pixel/AnimatedNumber';
import { DASHBOARD_TIME_RANGES, type TimeRangeDataset } from '../data/dashboardTimeRanges';

interface RiskOverviewProps {
  riskData?: TimeRangeDataset['risk'];
}

export const RiskOverview: React.FC<RiskOverviewProps> = ({
  riskData = DASHBOARD_TIME_RANGES['Last 7 Days'].risk,
}) => {
  return (
    <PixelCard className="h-full flex-1" innerClassName="p-4 justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#25204c]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center text-[#c084fc]">
            <PixelSlidersIcon size={18} />
          </div>
          <h3 className="text-[14px] font-bold text-white tracking-tight">
            Risk Overview
          </h3>
          <PixelInfoTooltip
            title="Risk Overview"
            content="Heuristic risk classification (0–100) assessing runtime threat severity across all evaluated events, categorized into Low, Medium, High, and Critical."
            tip="Risk scores ≥ 61 trigger review holds or policy blocks"
            align="left"
          />
        </div>

        <span className="text-[11px] font-mono font-bold text-[#f87171] bg-[#3a131b] border border-[#ef4444]/40 px-2 py-0.5 rounded-md">
          {riskData.criticalPercentage}% Critical
        </span>
      </div>

      {/* Rows - tightly spaced, balanced columns */}
      <div className="flex flex-col justify-between gap-2.5 my-auto py-1.5">
        {riskData.tiers.map((tier, index) => (
          <div
            key={tier.name}
            className="py-1 px-2 rounded-lg hover:bg-[#1f1b42] transition-colors"
          >
            <div className="flex items-center justify-between text-xs font-medium">
              {/* Color indicator + Name + Range */}
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-xs flex-shrink-0"
                  style={{ backgroundColor: tier.color }}
                />
                <span className="text-white font-bold text-[13px]">
                  {tier.name}
                </span>
                <span className="text-[#a59ecd] text-[11.5px] font-mono">
                  {tier.range}
                </span>
              </div>

              {/* Percentage & Count (Clear, Prominent) */}
              <div className="flex items-center gap-2.5">
                <span className="text-white text-[13px] font-mono font-bold tabular-nums min-w-[44px] text-right">
                  <AnimatedNumber value={tier.percentage} decimals={1} suffix="%" />
                </span>
                <span className="text-[#c7bff5] text-[11.5px] font-mono font-bold px-1.5 py-0.5 bg-[#231e4d] border border-[#3c3475] rounded-md shadow-xs min-w-[42px] text-center">
                  <AnimatedNumber value={tier.count} />
                </span>
              </div>
            </div>

            {/* Animated distribution bar */}
            <div className="mt-1.5 h-1.5 rounded-sm bg-[#211d47] overflow-hidden">
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
