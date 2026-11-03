import React from 'react';
import { PixelHeaderBackdrop } from '../pixel/PixelHeaderBackdrop';
import { PixelPlayIcon, PixelDatabaseIcon } from '../pixel/PixelIcons';

interface BenchmarkPageHeaderProps {
  onRunBenchmark: () => void;
  onViewDataset: () => void;
}

export const BenchmarkPageHeader: React.FC<BenchmarkPageHeaderProps> = ({
  onRunBenchmark,
  onViewDataset,
}) => {
  return (
    <div className="relative pt-1 pb-3 select-none">
      {/* Pixel-art background scene (Sunset Moon, Castle & Towers) */}
      <div className="absolute top-0 right-72 left-[300px] h-20 hidden lg:block opacity-95 overflow-hidden pointer-events-none">
        <PixelHeaderBackdrop className="w-full h-full" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* LEFT: TITLE & SUBTITLE */}
        <div>
          <h2 className="text-[26px] md:text-[28px] font-bold text-white tracking-tight leading-tight">
            Benchmarks
          </h2>
          <p className="text-[13.5px] font-medium text-[#938ebf] mt-0.5">
            Measure how well AgentShield prevents unsafe agent actions.
          </p>
        </div>

        {/* RIGHT: RUN BENCHMARK & VIEW DATASET ACTIONS */}
        <div className="flex items-center gap-2.5 self-start md:self-auto relative z-20">
          {/* Run Benchmark Button */}
          <button
            onClick={onRunBenchmark}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#6d3ee8] hover:bg-[#7b4cf0] active:scale-[0.98] text-white text-xs font-bold transition-all duration-150 border border-[#9674f7] shadow-[0_2px_12px_rgba(109,62,232,0.45)] cursor-pointer"
          >
            <PixelPlayIcon size={13} className="text-white" />
            <span>Run Benchmark</span>
          </button>

          {/* View Dataset Button */}
          <button
            onClick={onViewDataset}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1b1838] hover:bg-[#25214d] active:scale-[0.98] text-white text-xs font-semibold transition-all duration-150 border border-[#3c3470] hover:border-[#524796] shadow-sm cursor-pointer"
          >
            <PixelDatabaseIcon size={14} />
            <span>View Dataset</span>
          </button>
        </div>
      </div>
    </div>
  );
};

