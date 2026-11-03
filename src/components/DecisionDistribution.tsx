import React, { useState } from 'react';
import { PixelLayersIcon } from './pixel/PixelIcons';
import { PixelInfoTooltip } from './pixel/PixelInfoTooltip';
import { PixelCard } from './pixel/PixelCard';
import { AnimatedNumber } from './pixel/AnimatedNumber';
import { DASHBOARD_TIME_RANGES, type TimeRangeDataset } from '../data/dashboardTimeRanges';

interface DecisionDistributionProps {
  distributionData?: TimeRangeDataset['distribution'];
}

export const DecisionDistribution: React.FC<DecisionDistributionProps> = ({
  distributionData = DASHBOARD_TIME_RANGES['Last 7 Days'].distribution,
}) => {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const items = [
    {
      id: 'allowed',
      label: 'Allowed',
      percentage: distributionData.allowed.percentage,
      count: distributionData.allowed.count,
      color: '#22c55e',
      hoverColor: '#4ade80',
      glowFilter: 'url(#glow-green)',
      bgLight: 'bg-[#143e26]',
      borderLight: 'border-[#22c55e]/40',
      textColor: 'text-[#4ade80]',
    },
    {
      id: 'review',
      label: 'Review',
      percentage: distributionData.review.percentage,
      count: distributionData.review.count,
      color: '#eab308',
      hoverColor: '#facc15',
      glowFilter: 'url(#glow-yellow)',
      bgLight: 'bg-[#423311]',
      borderLight: 'border-[#eab308]/40',
      textColor: 'text-[#facc15]',
    },
    {
      id: 'blocked',
      label: 'Blocked',
      percentage: distributionData.blocked.percentage,
      count: distributionData.blocked.count,
      color: '#ef4444',
      hoverColor: '#f87171',
      glowFilter: 'url(#glow-red)',
      bgLight: 'bg-[#4a1923]',
      borderLight: 'border-[#ef4444]/40',
      textColor: 'text-[#f87171]',
    },
  ];

  // SVG metrics for an expanded, prominent donut chart
  const radius = 60;
  const circumference = 2 * Math.PI * radius; // ~376.991
  const total = distributionData.total || 1;

  const allowedLen = (distributionData.allowed.count / total) * circumference;
  const reviewLen = (distributionData.review.count / total) * circumference;
  const blockedLen = (distributionData.blocked.count / total) * circumference;

  const activeItem = items.find((it) => it.label === hoveredKey);

  return (
    <PixelCard className="h-full flex-1" innerClassName="p-4 justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#25204c]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center text-[#a855f7]">
            <PixelLayersIcon size={18} />
          </div>
          <h3 className="text-[14px] font-bold text-white tracking-tight">
            Decision Distribution
          </h3>
          <PixelInfoTooltip
            title="Decision Distribution"
            content="Enforcement breakdown across all monitored events, categorized into Allowed (safe), Review (held for human inspection), and Blocked (policy violation)."
            tip="Hover over donut slices or legend rows for detailed metrics"
            align="left"
          />
        </div>

        <span className="text-[11px] font-mono font-bold text-[#c084fc] bg-[#291e57] border border-[#523c9e]/40 px-2.5 py-0.5 rounded-md shadow-xs">
          <AnimatedNumber value={distributionData.total} /> Events
        </span>
      </div>

      {/* Main Container: Prominent Donut + Responsive Balanced Legend */}
      <div className="flex flex-row items-center justify-between gap-3.5 my-auto py-1 px-0.5">
        {/* Prominent Donut Chart */}
        <div className="relative flex items-center justify-center w-32 h-32 sm:w-36 sm:h-36 flex-shrink-0">
          <svg
            viewBox="0 0 160 160"
            className="w-full h-full pixelated transform -rotate-90 overflow-visible"
            shapeRendering="geometricPrecision"
          >
            <defs>
              <filter id="glow-green" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#22c55e" floodOpacity="0.85" />
              </filter>
              <filter id="glow-yellow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#eab308" floodOpacity="0.85" />
              </filter>
              <filter id="glow-red" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ef4444" floodOpacity="0.85" />
              </filter>
            </defs>

            {/* Dark background ring track */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke="#211d47"
              strokeWidth="18"
            />

            {/* Decorative retro pixel notches */}
            <circle
              cx="80"
              cy="80"
              r={radius + 13}
              fill="none"
              stroke="#2c255e"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <circle
              cx="80"
              cy="80"
              r={radius - 13}
              fill="none"
              stroke="#2c255e"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* 1. Allowed Segment (Green) */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={hoveredKey === 'Allowed' ? '#4ade80' : '#22c55e'}
              strokeWidth={hoveredKey === 'Allowed' ? 26 : 18}
              strokeDasharray={`${allowedLen} ${circumference}`}
              strokeDashoffset={0}
              filter={hoveredKey === 'Allowed' ? 'url(#glow-green)' : undefined}
              opacity={hoveredKey && hoveredKey !== 'Allowed' ? 0.35 : 1}
              className="cursor-pointer transition-all duration-300 ease-out origin-center"
              onMouseEnter={() => setHoveredKey('Allowed')}
              onMouseLeave={() => setHoveredKey(null)}
            />

            {/* 2. Review Segment (Yellow) */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={hoveredKey === 'Review' ? '#fde047' : '#eab308'}
              strokeWidth={hoveredKey === 'Review' ? 26 : 18}
              strokeDasharray={`${reviewLen} ${circumference}`}
              strokeDashoffset={-allowedLen}
              filter={hoveredKey === 'Review' ? 'url(#glow-yellow)' : undefined}
              opacity={hoveredKey && hoveredKey !== 'Review' ? 0.35 : 1}
              className="cursor-pointer transition-all duration-300 ease-out origin-center"
              onMouseEnter={() => setHoveredKey('Review')}
              onMouseLeave={() => setHoveredKey(null)}
            />

            {/* 3. Blocked Segment (Red) */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="none"
              stroke={hoveredKey === 'Blocked' ? '#f87171' : '#ef4444'}
              strokeWidth={hoveredKey === 'Blocked' ? 26 : 18}
              strokeDasharray={`${blockedLen} ${circumference}`}
              strokeDashoffset={-(allowedLen + reviewLen)}
              filter={hoveredKey === 'Blocked' ? 'url(#glow-red)' : undefined}
              opacity={hoveredKey && hoveredKey !== 'Blocked' ? 0.35 : 1}
              className="cursor-pointer transition-all duration-300 ease-out origin-center"
              onMouseEnter={() => setHoveredKey('Blocked')}
              onMouseLeave={() => setHoveredKey(null)}
            />
          </svg>

          {/* Dynamic Center Display (Updates smoothly on hover) */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-1">
            {activeItem ? (
              <div className="animate-in fade-in zoom-in-95 duration-200 flex flex-col items-center">
                <span className={`text-[19px] sm:text-[21px] font-mono font-bold tracking-tight leading-none ${activeItem.textColor}`}>
                  <AnimatedNumber value={activeItem.count} />
                </span>
                <span className={`text-[9.5px] font-bold uppercase tracking-wider mt-1 px-1.5 py-0.5 rounded ${activeItem.bgLight} ${activeItem.borderLight} ${activeItem.textColor}`}>
                  {activeItem.label} · {activeItem.percentage}%
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <span className="text-[19px] sm:text-[21px] font-mono font-bold text-white tracking-tight leading-none">
                  <AnimatedNumber value={distributionData.total} />
                </span>
                <span className="text-[9.5px] font-semibold text-[#b5aee0] uppercase tracking-wider mt-1">
                  Total Events
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Legend on the right - Interactive & High-Contrast */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {items.map((item) => {
            const isHovered = hoveredKey === item.label;

            return (
              <div
                key={item.label}
                onMouseEnter={() => setHoveredKey(item.label)}
                onMouseLeave={() => setHoveredKey(null)}
                className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition-all duration-150 ${
                  isHovered
                    ? `${item.bgLight} border ${item.borderLight} shadow-md scale-[1.02]`
                    : 'hover:bg-[#1f1a42] border border-transparent'
                }`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-xs flex-shrink-0 transition-transform duration-150 ${
                      isHovered ? 'scale-125 shadow-sm' : ''
                    }`}
                    style={{ backgroundColor: item.color }}
                  />
                  <span className={`text-[12px] font-semibold truncate ${isHovered ? 'text-white' : 'text-[#dedaf4]'}`}>
                    {item.label}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[11.5px] font-mono font-bold ${isHovered ? item.textColor : 'text-white'}`}>
                    <AnimatedNumber value={item.percentage} decimals={1} suffix="%" />
                  </span>
                  <span className="text-[#c7bff5] text-[10.5px] font-mono font-bold px-1.5 py-0.2 bg-[#231e4d] border border-[#3c3475] rounded shadow-xs">
                    <AnimatedNumber value={item.count} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PixelCard>
  );
};
