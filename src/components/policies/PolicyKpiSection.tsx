import React from 'react';
import { PixelLayersIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';
import { Archive } from 'lucide-react';

interface PolicyKpiSectionProps {
  totalCount: number;
  activeCount: number;
  draftCount: number;
  archivedCount: number;
}

export const PolicyKpiSection: React.FC<PolicyKpiSectionProps> = ({
  totalCount,
  activeCount,
  draftCount,
  archivedCount,
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-3.5">
      {/* 1. TOTAL POLICIES */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#26204d] border border-[#453c7a] text-[#c4bbf0] shadow-sm">
              <PixelLayersIcon size={18} />
            </div>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={totalCount} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Total Policies
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTIVE */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
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
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={activeCount} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Active
            </div>
          </div>
        </div>
      </div>

      {/* 3. DRAFT */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            {/* Amber Draft Pencil Circle Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#a16207]/30 border border-[#eab308]/60 shadow-[0_0_10px_rgba(234,179,8,0.25)]">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="pixelated" shapeRendering="crispEdges">
                <rect x="3" y="1" width="10" height="14" fill="#eab308" />
                <rect x="1" y="3" width="14" height="10" fill="#eab308" />
                <rect x="10" y="3" width="2" height="2" fill="#1b173b" />
                <rect x="7" y="6" width="3" height="3" fill="#1b173b" />
                <rect x="5" y="9" width="3" height="3" fill="#1b173b" />
                <rect x="4" y="11" width="2" height="2" fill="#1b173b" />
              </svg>
            </div>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={draftCount} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Draft
            </div>
          </div>
        </div>
      </div>

      {/* 4. ARCHIVED */}
      <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#4c4294] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between min-h-[105px]">
          <div className="flex items-start justify-between">
            {/* Archive Box Pixel Icon */}
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#26204d] border border-[#453c7a] text-[#8e87bf] shadow-sm">
              <Archive size={17} />
            </div>
          </div>

          <div className="mt-2">
            <div className="text-[26px] font-bold text-white tracking-tight leading-none font-mono">
              <AnimatedNumber value={archivedCount} />
            </div>
            <div className="text-xs font-medium text-[#9c96c9] mt-1">
              Archived
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

