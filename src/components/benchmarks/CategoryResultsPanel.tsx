import React from 'react';
import { PixelCubeBoxIcon } from '../pixel/PixelIcons';
import { PixelInfoTooltip } from '../pixel/PixelInfoTooltip';
import type { BenchmarkRunRecord } from './benchmarkTypes';

interface CategoryResultsPanelProps {
  currentRun: BenchmarkRunRecord;
}

export const CategoryResultsPanel: React.FC<CategoryResultsPanelProps> = ({ currentRun }) => {


  return (
    <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#453c85] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150 h-full flex flex-col">
      <div className="w-full h-full bg-[#16142e] pixel-corners p-4 md:p-4.5 flex flex-col justify-between">
        {/* PANEL HEADER */}
        <div className="flex items-center justify-between pb-3 border-b border-[#292254]">
          <div className="flex items-center gap-2">
            <PixelCubeBoxIcon size={18} />
            <span className="text-sm font-bold text-white tracking-wide">
              Test Case Results by Category
            </span>
            <PixelInfoTooltip
              title="Test Case Categories"
              content="Validation pass rates across six OWASP LLM and Agentic attack and authorization vector categories."
              align="left"
            />
          </div>
        </div>

        {/* 6 CATEGORY ROWS */}
        <div className="flex-1 flex flex-col justify-around py-2.5 space-y-3">
          {currentRun.categoryResults.map((cat, index) => {
            const pct = Math.min(100, Math.max(0, (cat.completed / cat.total) * 100));

            return (
              <div key={cat.category} className="flex items-center gap-3">
                {/* Left: Category Title */}
                <div className="w-48 sm:w-56 flex-shrink-0 text-xs font-semibold text-[#dedaf4] truncate">
                  {cat.category}
                </div>

                {/* Center: Progress Bar Track */}
                <div className="flex-1 h-2 rounded-xs bg-[#201d40] overflow-hidden">
                  <div
                    className="h-full bg-[#22c55e] rounded-xs shadow-[0_0_8px_rgba(34,197,94,0.35)] transition-all duration-300 bar-grow"
                    style={{ width: `${pct}%`, animationDelay: `${index * 70}ms` }}
                  />
                </div>

                {/* Right: Ratio fraction */}
                <div className="w-9 text-right text-xs font-mono font-bold text-white">
                  {cat.ratio}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
