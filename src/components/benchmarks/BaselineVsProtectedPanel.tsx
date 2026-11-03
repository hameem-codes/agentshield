import React from 'react';
import { PixelStarShieldBadgeIcon, PixelInfoIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';
import type { BenchmarkRunRecord } from './benchmarkTypes';
import { getComparisonMetrics } from './benchmarkData';

interface BaselineVsProtectedPanelProps {
  currentRun: BenchmarkRunRecord;
}

export const BaselineVsProtectedPanel: React.FC<BaselineVsProtectedPanelProps> = ({ currentRun }) => {
  const metrics = getComparisonMetrics(currentRun);
  const [showTooltip, setShowTooltip] = React.useState(false);

  return (
    <div className="relative p-[1.5px] bg-[#3a3273] hover:bg-[#453c85] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.4)] transition-colors duration-150 h-full flex flex-col">
      <div className="w-full h-full bg-[#16142e] pixel-corners p-4 md:p-4.5 flex flex-col justify-between">
        {/* PANEL HEADER */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[#292254]">
          <div className="flex items-center gap-2">
            <PixelStarShieldBadgeIcon size={18} />
            <span className="text-sm font-bold text-white tracking-wide">
              Baseline vs Protected
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTooltip(!showTooltip)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="text-[#847ea8] hover:text-[#c4bbf0] transition-colors cursor-pointer"
                title="About comparison metrics"
              >
                <PixelInfoIcon size={14} />
              </button>
              {showTooltip && (
                <div className="absolute left-0 top-6 w-64 p-2.5 bg-[#1b1739] border border-[#443a7b] rounded-lg shadow-xl text-[11px] text-[#ded9f5] z-30 leading-relaxed pointer-events-none">
                  Compares baseline execution without guardrails vs protected execution under AgentShield runtime policies.
                </div>
              )}
            </div>
          </div>

          {/* LEGEND */}
          <div className="flex items-center gap-4 text-xs font-medium">
            <div className="flex items-center gap-1.5 text-[#b0a9db]">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#73708e]" />
              <span>Baseline (No Shield)</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#b0a9db]">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#22c55e]" />
              <span>Protected (AgentShield)</span>
            </div>
          </div>
        </div>

        {/* COMPARISON METRIC ROWS */}
        <div className="flex-1 flex flex-col justify-around py-2.5 space-y-3.5">
          {metrics.map((m, index) => {
            // max is 16; scale to ~88% max bar width so labels comfortably fit on right
            const maxTrackPercent = 88;
            const baselineBarWidth = (m.baseline / m.max) * maxTrackPercent;
            const protectedBarWidth = (m.protected / m.max) * maxTrackPercent;

            return (
              <div key={m.category} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                {/* Left: Category Label */}
                <div className="w-48 sm:w-52 flex-shrink-0 text-xs font-semibold text-[#dedaf4]">
                  {m.category}
                </div>

                {/* Right: Dual Bar Visualizer */}
                <div className="flex-1 flex flex-col gap-1.5">
                  {/* Top Bar: Baseline (Grey) */}
                  <div className="flex items-center gap-2 h-3.5">
                    {m.baseline > 0 ? (
                      <div
                        className="h-2 rounded-xs bg-[#73708e] transition-all duration-300 bar-grow"
                        style={{
                          width: `${baselineBarWidth}%`,
                          animationDelay: `${index * 90}ms`,
                        }}
                      />
                    ) : (
                      <div className="w-1.5 h-2 rounded-xs bg-[#5a5676]" />
                    )}
                    <span className="text-xs font-mono font-bold text-[#d2ccf0]">
                      <AnimatedNumber value={m.baseline} />
                    </span>
                  </div>

                  {/* Bottom Bar: Protected (Bright Green) */}
                  <div className="flex items-center gap-2 h-3.5">
                    {m.protected > 0 ? (
                      <div
                        className="h-2 rounded-xs bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.4)] transition-all duration-300 bar-grow"
                        style={{
                          width: `${protectedBarWidth}%`,
                          animationDelay: `${index * 90 + 60}ms`,
                        }}
                      />
                    ) : (
                      <div className="w-1.5 h-2 rounded-xs bg-[#1f5933]" />
                    )}
                    <span className={`text-xs font-mono font-bold ${
                      m.protected > 0 ? 'text-[#4ade80]' : 'text-[#7e78a6]'
                    }`}>
                      <AnimatedNumber value={m.protected} />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
