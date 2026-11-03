import React from 'react';
import { PixelSparkline } from '../pixel/PixelSparkline';
import { PixelLayersIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';
import { DASHBOARD_TIME_RANGES, type TimeRangeDataset } from '../../data/dashboardTimeRanges';

interface EventsKpiSectionProps {
  kpiData?: TimeRangeDataset;
}

export const EventsKpiSection: React.FC<EventsKpiSectionProps> = ({
  kpiData = DASHBOARD_TIME_RANGES['Last 7 Days'],
}) => {
  const total = kpiData.totalEvents.value || 1;
  const allowedPercent = Number(((kpiData.allowed.value / total) * 100).toFixed(1));
  const reviewPercent = Number(((kpiData.review.value / total) * 100).toFixed(1));
  const blockedPercent = Number(((kpiData.blocked.value / total) * 100).toFixed(1));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
      {/* 1. TOTAL EVENTS */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[114px]">
          <div className="flex items-start justify-between">
            {/* Top Left Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#26204d] border border-[#453c7a] text-[#c4bbf0] shadow-sm">
              <PixelLayersIcon size={18} />
            </div>

            {/* Top Right Percentage Badge */}
            <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#2b1f54] border border-[#533b9c] text-[#d8b4fe] text-xs font-bold font-mono">
              <span>↑</span>
              <AnimatedNumber value={kpiData.totalEvents.change} prefix="+" suffix="%" />
            </div>
          </div>

          <div className="mt-2.5 flex items-end justify-between">
            <div>
              <div className="text-[28px] font-bold text-white tracking-tight leading-none font-mono">
                <AnimatedNumber value={kpiData.totalEvents.value} />
              </div>
              <div className="text-xs font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
                Total Events
              </div>
            </div>
            <span className="text-[11px] font-mono font-bold text-[#c084fc] bg-[#22174d] border border-[#4c3599]/40 px-2 py-0.5 rounded-md">
              {kpiData.totalEvents.avgRate}
            </span>
          </div>
        </div>
      </div>

      {/* 2. ALLOWED */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[114px] overflow-hidden relative">
          <div className="flex items-start justify-between relative z-10">
            {/* Green Check Circle Pixel Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#15803d]/30 border border-[#22c55e]/60 shadow-[0_0_10px_rgba(34,197,94,0.25)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="pixelated" shapeRendering="crispEdges">
                <rect x="3" y="1" width="10" height="14" fill="#22c55e" />
                <rect x="1" y="3" width="14" height="10" fill="#22c55e" />
                <rect x="4" y="8" width="2" height="2" fill="#ffffff" />
                <rect x="6" y="10" width="2" height="2" fill="#ffffff" />
                <rect x="8" y="8" width="2" height="2" fill="#ffffff" />
                <rect x="10" y="6" width="2" height="2" fill="#ffffff" />
                <rect x="11" y="5" width="2" height="2" fill="#ffffff" />
              </svg>
            </div>

            {/* Top Right Percentage Badge */}
            <div className="px-2.5 py-0.5 rounded-md bg-[#133821] border border-[#22c55e]/40 text-[#86efac] text-xs font-bold font-mono">
              <AnimatedNumber value={allowedPercent} decimals={1} suffix="%" />
            </div>
          </div>

          <div className="flex items-end justify-between mt-2.5 relative z-10">
            <div>
              <div className="text-[28px] font-bold text-white tracking-tight leading-none font-mono">
                <AnimatedNumber value={kpiData.allowed.value} />
              </div>
              <div className="text-xs font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
                Allowed
              </div>
            </div>

            {/* Sparkline on Bottom Right with Peak statistic */}
            <div className="flex flex-col items-end opacity-95">
              <span className="text-[10.5px] font-mono font-bold text-[#4ade80] bg-[#113822] px-1.5 py-0.2 rounded border border-[#22c55e]/30 mb-1">
                {kpiData.allowed.peakValue} peak
              </span>
              {kpiData.allowed.sparkline && (
                <PixelSparkline
                  key={`events-allowed-${kpiData.label}`}
                  color="green"
                  data={kpiData.allowed.sparkline}
                  width={106}
                  height={34}
                  valueSuffix={kpiData.allowed.sparklineUnit}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 3. REVIEW */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[114px] overflow-hidden relative">
          <div className="flex items-start justify-between relative z-10">
            {/* Yellow Clock Circle Pixel Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#a16207]/30 border border-[#eab308]/60 shadow-[0_0_10px_rgba(234,179,8,0.25)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="pixelated" shapeRendering="crispEdges">
                <rect x="3" y="1" width="10" height="14" fill="#eab308" />
                <rect x="1" y="3" width="14" height="10" fill="#eab308" />
                <rect x="7" y="4" width="2" height="5" fill="#1b173b" />
                <rect x="8" y="7" width="4" height="2" fill="#1b173b" />
              </svg>
            </div>

            {/* Top Right Percentage Badge */}
            <div className="px-2.5 py-0.5 rounded-md bg-[#2d2208] border border-[#eab308]/40 text-[#fde047] text-xs font-bold font-mono">
              <AnimatedNumber value={reviewPercent} decimals={1} suffix="%" />
            </div>
          </div>

          <div className="flex items-end justify-between mt-2.5 relative z-10">
            <div>
              <div className="text-[28px] font-bold text-white tracking-tight leading-none font-mono">
                <AnimatedNumber value={kpiData.review.value} />
              </div>
              <div className="text-xs font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
                Review
              </div>
            </div>

            {/* Sparkline on Bottom Right with Peak statistic */}
            <div className="flex flex-col items-end opacity-95">
              <span className="text-[10.5px] font-mono font-bold text-[#facc15] bg-[#332508] px-1.5 py-0.2 rounded border border-[#eab308]/30 mb-1">
                {kpiData.review.peakValue} peak
              </span>
              {kpiData.review.sparkline && (
                <PixelSparkline
                  key={`events-review-${kpiData.label}`}
                  color="yellow"
                  data={kpiData.review.sparkline}
                  width={106}
                  height={34}
                  valueSuffix={kpiData.review.sparklineUnit}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 4. BLOCKED */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[114px] overflow-hidden relative">
          <div className="flex items-start justify-between relative z-10">
            {/* Red Shield Cross Pixel Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#991b1b]/30 border border-[#ef4444]/60 shadow-[0_0_10px_rgba(239,68,68,0.25)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="pixelated" shapeRendering="crispEdges">
                <rect x="3" y="1" width="10" height="14" fill="#ef4444" />
                <rect x="1" y="3" width="14" height="10" fill="#ef4444" />
                <rect x="4" y="4" width="2" height="2" fill="#ffffff" />
                <rect x="10" y="4" width="2" height="2" fill="#ffffff" />
                <rect x="6" y="6" width="4" height="4" fill="#ffffff" />
                <rect x="4" y="10" width="2" height="2" fill="#ffffff" />
                <rect x="10" y="10" width="2" height="2" fill="#ffffff" />
              </svg>
            </div>

            {/* Top Right Percentage Badge */}
            <div className="px-2.5 py-0.5 rounded-md bg-[#331111] border border-[#ef4444]/40 text-[#fca5a5] text-xs font-bold font-mono">
              <AnimatedNumber value={blockedPercent} decimals={1} suffix="%" />
            </div>
          </div>

          <div className="flex items-end justify-between mt-2.5 relative z-10">
            <div>
              <div className="text-[28px] font-bold text-white tracking-tight leading-none font-mono">
                <AnimatedNumber value={kpiData.blocked.value} />
              </div>
              <div className="text-xs font-semibold text-[#a59ecd] mt-1.5 uppercase tracking-wider">
                Blocked
              </div>
            </div>

            {/* Sparkline on Bottom Right with Peak statistic */}
            <div className="flex flex-col items-end opacity-95">
              <span className="text-[10.5px] font-mono font-bold text-[#f87171] bg-[#3a131b] px-1.5 py-0.2 rounded border border-[#ef4444]/30 mb-1">
                {kpiData.blocked.peakValue} peak
              </span>
              {kpiData.blocked.sparkline && (
                <PixelSparkline
                  key={`events-blocked-${kpiData.label}`}
                  color="red"
                  data={kpiData.blocked.sparkline}
                  width={106}
                  height={34}
                  valueSuffix={kpiData.blocked.sparklineUnit}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
