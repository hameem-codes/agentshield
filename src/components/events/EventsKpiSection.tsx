import React from 'react';
import { PixelSparkline } from '../pixel/PixelSparkline';
import { PixelLayersIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';

export const EventsKpiSection: React.FC = () => {
  // Sparkline historical trends matching IMAGE 2
  const allowedTrend = [18, 22, 19, 28, 24, 32, 29, 36, 42, 38, 45, 52];
  const reviewTrend = [12, 16, 22, 18, 24, 15, 26, 32, 28, 35, 30, 34];
  const blockedTrend = [8, 12, 10, 16, 14, 20, 18, 24, 21, 28, 25, 30];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
      {/* 1. TOTAL EVENTS */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[108px]">
          <div className="flex items-start justify-between">
            {/* Top Left Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#26204d] border border-[#453c7a] text-[#c4bbf0] shadow-sm">
              <PixelLayersIcon size={18} />
            </div>

            {/* Top Right Percentage Badge */}
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#2b1f54] border border-[#533b9c] text-[#d8b4fe] text-xs font-semibold">
              <span>↑</span>
              <AnimatedNumber value={12} prefix="+" suffix="%" />
            </div>
          </div>

          <div className="mt-2.5">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={3842} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Total Events
            </div>
          </div>
        </div>
      </div>

      {/* 2. ALLOWED */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[108px] overflow-hidden relative">
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
            <div className="px-2 py-0.5 rounded-md bg-[#1d1a3d] border border-[#39326b] text-[#a59ecd] text-xs font-semibold">
              <AnimatedNumber value={77.5} decimals={1} suffix="%" />
            </div>
          </div>

          <div className="flex items-end justify-between mt-2.5 relative z-10">
            <div>
              <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
                <AnimatedNumber value={2976} />
              </div>
              <div className="text-xs font-medium text-[#9c96c9] mt-1">
                Allowed
              </div>
            </div>

            {/* Sparkline on Bottom Right */}
            <div className="opacity-95 -mb-1">
              <PixelSparkline color="green" data={allowedTrend} width={100} height={32} />
            </div>
          </div>
        </div>
      </div>

      {/* 3. REVIEW */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[108px] overflow-hidden relative">
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
            <div className="px-2 py-0.5 rounded-md bg-[#1d1a3d] border border-[#39326b] text-[#a59ecd] text-xs font-semibold">
              <AnimatedNumber value={11.4} decimals={1} suffix="%" />
            </div>
          </div>

          <div className="flex items-end justify-between mt-2.5 relative z-10">
            <div>
              <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
                <AnimatedNumber value={437} />
              </div>
              <div className="text-xs font-medium text-[#9c96c9] mt-1">
                Review
              </div>
            </div>

            {/* Sparkline on Bottom Right */}
            <div className="opacity-95 -mb-1">
              <PixelSparkline color="yellow" data={reviewTrend} width={100} height={32} />
            </div>
          </div>
        </div>
      </div>

      {/* 4. BLOCKED */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[108px] overflow-hidden relative">
          <div className="flex items-start justify-between relative z-10">
            {/* Red Cross Circle Pixel Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#b91c1c]/30 border border-[#ef4444]/60 shadow-[0_0_10px_rgba(239,68,68,0.25)]">
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
            <div className="px-2 py-0.5 rounded-md bg-[#1d1a3d] border border-[#39326b] text-[#a59ecd] text-xs font-semibold">
              <AnimatedNumber value={11.2} decimals={1} suffix="%" />
            </div>
          </div>

          <div className="flex items-end justify-between mt-2.5 relative z-10">
            <div>
              <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
                <AnimatedNumber value={429} />
              </div>
              <div className="text-xs font-medium text-[#9c96c9] mt-1">
                Blocked
              </div>
            </div>

            {/* Sparkline on Bottom Right */}
            <div className="opacity-95 -mb-1">
              <PixelSparkline color="red" data={blockedTrend} width={100} height={32} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

