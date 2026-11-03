import React from 'react';
import {
  PixelLayersIcon,
  PixelCheckCircleIcon,
  PixelCrossShieldIcon,
  PixelTrendingUpGreenIcon,
  PixelWarningTriangleIcon,
} from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';
import type { BenchmarkRunRecord } from './benchmarkTypes';

interface BenchmarkKpiSectionProps {
  currentRun: BenchmarkRunRecord;
}

export const BenchmarkKpiSection: React.FC<BenchmarkKpiSectionProps> = ({ currentRun }) => {
  const bypassRate = currentRun.total > 0
    ? (currentRun.bypasses / currentRun.total) * 100
    : 0;

  const fpRate = currentRun.total > 0
    ? (currentRun.fp / currentRun.total) * 100
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 mb-3.5">
      {/* 1. TOTAL TEST CASES */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#26204d] border border-[#453c7a] text-[#c4bbf0] shadow-sm">
              <PixelLayersIcon size={18} />
            </div>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={currentRun.total} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Total Test Cases
            </div>
          </div>
        </div>
      </div>

      {/* 2. BENIGN CASES */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#143d26] border border-[#22c55e]/50 shadow-[0_0_10px_rgba(34,197,94,0.25)]">
              <PixelCheckCircleIcon size={18} />
            </div>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={currentRun.benignCases} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Benign Cases
            </div>
          </div>
        </div>
      </div>

      {/* 3. MALICIOUS CASES */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3d1620] border border-[#ef4444]/50 shadow-[0_0_10px_rgba(239,68,68,0.25)]">
              <PixelCrossShieldIcon size={18} />
            </div>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={currentRun.maliciousCases} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Malicious Cases
            </div>
          </div>
        </div>
      </div>

      {/* 4. SUCCESSFUL BYPASSES */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#143d26] border border-[#22c55e]/50 text-[#4ade80] shadow-sm">
              <PixelTrendingUpGreenIcon size={18} />
            </div>
            {/* Top Right Green Pill: ✓ 0% */}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#134426] border border-[#22c55e]/40 text-[#4ade80] text-[11px] font-bold tracking-wide">
              <span>✓</span>
              <AnimatedNumber value={bypassRate} decimals={0} suffix="%" />
            </span>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={currentRun.bypasses} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Successful Bypasses
            </div>
          </div>
        </div>
      </div>

      {/* 5. FALSE POSITIVES */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#3d3215] border border-[#eab308]/50 shadow-sm">
              <PixelWarningTriangleIcon size={18} />
            </div>
            {/* Top Right Yellow Pill: 6.3% */}
            <span className="px-2 py-0.5 rounded-md bg-[#423312] border border-[#eab308]/40 text-[#fde047] text-[11px] font-bold tracking-wide">
              <AnimatedNumber value={fpRate} decimals={1} suffix="%" />
            </span>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={currentRun.fp} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              False Positives
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
