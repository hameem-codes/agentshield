import React from 'react';
import {
  PixelLayersIcon,
  PixelCheckCircleIcon,
  PixelClockCircleIcon,
  PixelCrossShieldIcon,
} from './pixel/PixelIcons';
import { PixelSparkline } from './pixel/PixelSparkline';
import { PixelCard } from './pixel/PixelCard';
import { AnimatedNumber } from './pixel/AnimatedNumber';
import { DASHBOARD_TIME_RANGES, type TimeRangeDataset } from '../data/dashboardTimeRanges';

interface KpiSectionProps {
  data?: TimeRangeDataset;
}

export const KpiSection: React.FC<KpiSectionProps> = ({
  data = DASHBOARD_TIME_RANGES['Last 7 Days'],
}) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Card 1: Total Events */}
      <PixelCard innerClassName="p-4 justify-between min-h-[120px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#2b1f59] border border-[#483594] text-[#c084fc] shadow-xs">
            <PixelLayersIcon size={20} />
          </div>
          <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-[#d8b4fe] bg-[#2a1f52] border border-[#4a378e] rounded-md shadow-xs font-mono">
            <span>↑</span> <AnimatedNumber value={data.totalEvents.change} prefix="+" suffix="%" />
          </span>
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div>
            <div className="text-[30px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={data.totalEvents.value} />
            </div>
            <div className="text-[11.5px] font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
              Total Events
            </div>
          </div>
          <div className="text-right pb-1">
            <span className="inline-block px-2 py-1 text-[11px] font-mono font-bold text-[#c084fc] bg-[#22174d] border border-[#4c3599]/40 rounded-md">
              {data.totalEvents.avgRate}
            </span>
          </div>
        </div>
      </PixelCard>

      {/* Card 2: Allowed */}
      <PixelCard innerClassName="p-4 justify-between min-h-[120px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#143e26] border border-[#1b6b3e] text-[#4ade80] shadow-xs">
            <PixelCheckCircleIcon size={20} />
          </div>
          <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-[#86efac] bg-[#123823] border border-[#22c55e]/40 rounded-md shadow-xs font-mono">
            <span>↑</span> <AnimatedNumber value={data.allowed.change} prefix="+" suffix="%" />
          </span>
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div>
            <div className="text-[30px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={data.allowed.value} />
            </div>
            <div className="text-[11.5px] font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
              Allowed
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10.5px] font-medium text-[#7a9e88] uppercase tracking-wider">{data.allowed.peakLabel}</span>
              <span className="text-[11px] font-mono font-bold text-[#4ade80] bg-[#113822] px-1.5 py-0.2 rounded border border-[#22c55e]/30">
                {data.allowed.peakValue}
              </span>
            </div>
            {data.allowed.sparkline && (
              <PixelSparkline
                key={`allowed-${data.label}`}
                color="green"
                data={data.allowed.sparkline}
                width={106}
                height={34}
                valueSuffix={data.allowed.sparklineUnit}
              />
            )}
          </div>
        </div>
      </PixelCard>

      {/* Card 3: Review */}
      <PixelCard innerClassName="p-4 justify-between min-h-[120px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#423311] border border-[#785b19] text-[#facc15] shadow-xs">
            <PixelClockCircleIcon size={20} />
          </div>
          <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-[#fde047] bg-[#3a2c0c] border border-[#eab308]/40 rounded-md shadow-xs font-mono">
            <span>↑</span> <AnimatedNumber value={data.review.change} prefix="+" suffix="%" />
          </span>
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div>
            <div className="text-[30px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={data.review.value} />
            </div>
            <div className="text-[11.5px] font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
              Review
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10.5px] font-medium text-[#998b68] uppercase tracking-wider">{data.review.peakLabel}</span>
              <span className="text-[11px] font-mono font-bold text-[#facc15] bg-[#362a0c] px-1.5 py-0.2 rounded border border-[#eab308]/30">
                {data.review.peakValue}
              </span>
            </div>
            {data.review.sparkline && (
              <PixelSparkline
                key={`review-${data.label}`}
                color="yellow"
                data={data.review.sparkline}
                width={106}
                height={34}
                valueSuffix={data.review.sparklineUnit}
              />
            )}
          </div>
        </div>
      </PixelCard>

      {/* Card 4: Blocked */}
      <PixelCard innerClassName="p-4 justify-between min-h-[120px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#4a1923] border border-[#802b3d] text-[#f87171] shadow-xs">
            <PixelCrossShieldIcon size={20} />
          </div>
          <span className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-bold text-[#fca5a5] bg-[#3d141c] border border-[#ef4444]/40 rounded-md shadow-xs font-mono">
            <span>↑</span> <AnimatedNumber value={data.blocked.change} prefix="+" suffix="%" />
          </span>
        </div>
        <div className="flex items-end justify-between mt-2.5">
          <div>
            <div className="text-[30px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={data.blocked.value} />
            </div>
            <div className="text-[11.5px] font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
              Blocked
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[10.5px] font-medium text-[#9e767e] uppercase tracking-wider">{data.blocked.peakLabel}</span>
              <span className="text-[11px] font-mono font-bold text-[#f87171] bg-[#3b121a] px-1.5 py-0.2 rounded border border-[#ef4444]/30">
                {data.blocked.peakValue}
              </span>
            </div>
            {data.blocked.sparkline && (
              <PixelSparkline
                key={`blocked-${data.label}`}
                color="red"
                data={data.blocked.sparkline}
                width={106}
                height={34}
                valueSuffix={data.blocked.sparklineUnit}
              />
            )}
          </div>
        </div>
      </PixelCard>
    </div>
  );
};
