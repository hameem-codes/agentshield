import React, { useState, useRef, useEffect } from 'react';
import { PixelLightningIcon } from './pixel/PixelIcons';
import { PixelInfoTooltip } from './pixel/PixelInfoTooltip';
import { PixelCard } from './pixel/PixelCard';
import { ChevronDown, Check } from 'lucide-react';
import { DASHBOARD_TIME_RANGES, type TimeRangeDataset } from '../data/dashboardTimeRanges';

interface SecurityActivityChartProps {
  chartData?: TimeRangeDataset['chart'];
}

export const SecurityActivityChart: React.FC<SecurityActivityChartProps> = ({
  chartData = DASHBOARD_TIME_RANGES['Last 7 Days'].chart,
}) => {
  const getGranularityForUnit = (unit?: string) => {
    if (unit === 'h') return 'Events (Hourly)';
    if (unit === 'w') return 'Events (Weekly)';
    return 'Events (Daily)';
  };

  const [granularity, setGranularity] = useState(() => getGranularityForUnit(chartData?.unit));
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setGranularity(getGranularityForUnit(chartData?.unit));
  }, [chartData?.unit]);

  const data = chartData.data;
  const chartHeight = 165;
  const chartWidth = 470;
  const paddingLeft = 46;
  const paddingRight = 14;
  const paddingTop = 16;
  const paddingBottom = 26;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const maxY = chartData.maxY;

  const getY = (val: number) => paddingTop + innerHeight - (val / maxY) * innerHeight;
  const getX = (index: number) => paddingLeft + (index / (data.length - 1)) * innerWidth;

  const buildPath = (key: 'allowed' | 'review' | 'blocked') => {
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`).join(' ');
  };

  const allowedPath = buildPath('allowed');
  const reviewPath = buildPath('review');
  const blockedPath = buildPath('blocked');
  const allowedArea = `${allowedPath} L ${getX(data.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

  // Continuous mouse tracking across the entire chart area (zero dead zones)
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    // Map mouseX from screen pixels to SVG viewBox space (0 to chartWidth)
    const svgX = (mouseX / rect.width) * chartWidth;

    // Check if within bounds
    if (svgX < paddingLeft - 25 || svgX > chartWidth - paddingRight + 25) {
      setHoveredIdx(null);
      return;
    }

    const norm = (svgX - paddingLeft) / innerWidth;
    const clampedIdx = Math.max(0, Math.min(data.length - 1, Math.round(norm * (data.length - 1))));
    setHoveredIdx(clampedIdx);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  const activePoint = hoveredIdx !== null && hoveredIdx < data.length ? data[hoveredIdx] : null;
  const activeX = hoveredIdx !== null && hoveredIdx < data.length ? getX(hoveredIdx) : 0;
  const activePercent = (activeX / chartWidth) * 100;

  return (
    <PixelCard innerClassName="p-4 justify-between h-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-[#25204c]">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center text-yellow-400">
            <PixelLightningIcon size={18} />
          </div>
          <h3 className="text-[14px] font-bold text-white tracking-tight">
            Security Activity
          </h3>
          <PixelInfoTooltip
            title="Security Activity"
            content="Chronological timeline of agent evaluation events over the active timeframe, plotting Allowed, Review, and Blocked volumes."
            tip="Hover over any point along the curve to see exact metrics"
            align="left"
          />
        </div>

        {/* Header Stats & Filter */}
        <div className="flex items-center gap-2.5">
          <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-[#86efac] bg-[#123823] border border-[#22c55e]/30 rounded-md shadow-xs">
            {chartData.peak}
          </span>

          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-[#221f45] border border-[#39316d] rounded-md hover:border-[#52479e] transition-colors shadow-xs"
            >
              <span>{granularity}</span>
              <ChevronDown size={13} className="text-[#9690c2]" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-1 w-36 p-1 bg-[#1a1738] border border-[#3c3475] rounded-xl shadow-xl z-50">
                {['Events (Hourly)', 'Events (Daily)', 'Events (Weekly)'].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setGranularity(opt);
                      setDropdownOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-2.5 py-1 text-xs rounded-md text-left ${
                      granularity === opt
                        ? 'bg-[#6d3ee8] text-white'
                        : 'text-[#a49ecc] hover:bg-[#25204c] hover:text-white'
                    }`}
                  >
                    <span>{opt}</span>
                    {granularity === opt && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Chart Area */}
      <div className="relative w-full my-auto overflow-visible py-2">
        {/* Dynamic Floating Tooltip: Follows the exact point being hovered */}
        {hoveredIdx !== null && activePoint && (
          <div
            className="absolute z-30 pointer-events-none transition-all duration-150 ease-out flex flex-col items-center -top-8"
            style={{
              left: `${activePercent}%`,
              transform:
                hoveredIdx === 0
                  ? 'translateX(0%)'
                  : hoveredIdx === data.length - 1
                  ? 'translateX(-100%)'
                  : 'translateX(-50%)',
            }}
          >
            <div className="px-3 py-1.5 bg-[#14122b]/95 border border-[#6d3ee8] rounded-lg shadow-2xl text-xs font-mono flex items-center gap-2.5 backdrop-blur-md">
              <span className="font-bold text-white uppercase tracking-wider">{activePoint.day}:</span>
              <span className="text-[#4ade80] font-bold bg-[#143e26] px-1.5 py-0.5 rounded border border-[#22c55e]/40">
                {activePoint.allowed} Allowed
              </span>
              <span className="text-[#facc15] font-bold bg-[#423311] px-1.5 py-0.5 rounded border border-[#eab308]/40">
                {activePoint.review} Review
              </span>
              <span className="text-[#f87171] font-bold bg-[#4a1923] px-1.5 py-0.5 rounded border border-[#ef4444]/40">
                {activePoint.blocked} Blocked
              </span>
            </div>
            {/* Pointer arrow aligning directly above active vertical crosshair */}
            <div className="w-2 h-2 bg-[#14122b] border-r border-b border-[#6d3ee8] transform rotate-45 -mt-1" />
          </div>
        )}

        <svg
          ref={svgRef}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none cursor-crosshair"
          shapeRendering="geometricPrecision"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Y Axis Gridlines and Labels */}
          {chartData.ticks.map((val) => {
            const y = getY(val);
            return (
              <g key={val}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={chartWidth - paddingRight}
                  y2={y}
                  stroke="#292353"
                  strokeWidth="1"
                  strokeDasharray={val === 0 ? undefined : '2,2'}
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  textAnchor="end"
                  fill="#c8c2ee"
                  fontSize="12"
                  fontWeight="600"
                  fontFamily="'JetBrains Mono', 'Fira Code', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
                >
                  {val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : val}
                </text>
              </g>
            );
          })}

          {/* Area under Allowed line */}
          <path d={allowedArea} fill="rgba(34, 197, 94, 0.16)" className="chart-area" />

          {/* Allowed Line (Green) */}
          <path
            d={allowedPath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2.5"
            strokeLinecap="square"
            strokeLinejoin="round"
            pathLength={1}
            className="chart-line"
          />

          {/* Review Line (Yellow) */}
          <path
            d={reviewPath}
            fill="none"
            stroke="#eab308"
            strokeWidth="2.5"
            strokeLinecap="square"
            strokeLinejoin="round"
            pathLength={1}
            className="chart-line"
            style={{ animationDelay: '140ms' }}
          />

          {/* Blocked Line (Red) */}
          <path
            d={blockedPath}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2.5"
            strokeLinecap="square"
            strokeLinejoin="round"
            pathLength={1}
            className="chart-line"
            style={{ animationDelay: '260ms' }}
          />

          {/* Active Crosshair Guideline (Snaps directly to active point) */}
          {hoveredIdx !== null && hoveredIdx < data.length && (
            <line
              x1={activeX}
              y1={paddingTop}
              x2={activeX}
              y2={paddingTop + innerHeight}
              stroke="#8b5cf6"
              strokeWidth="1.5"
              strokeDasharray="3,3"
              className="pointer-events-none"
            />
          )}

          {/* Square Pixel Markers & X-Axis Day Labels */}
          {data.map((d, i) => {
            const x = getX(i);
            const yAllowed = getY(d.allowed);
            const yReview = getY(d.review);
            const yBlocked = getY(d.blocked);
            const isHovered = hoveredIdx === i;

            return (
              <g key={d.day} className="pointer-events-none">
                {/* Allowed Marker */}
                <rect
                  x={isHovered ? x - 4 : x - 3}
                  y={isHovered ? yAllowed - 4 : yAllowed - 3}
                  width={isHovered ? 8 : 6}
                  height={isHovered ? 8 : 6}
                  fill={isHovered ? '#ffffff' : '#22c55e'}
                  stroke={isHovered ? '#22c55e' : '#121124'}
                  strokeWidth={isHovered ? 2 : 1}
                  shapeRendering="crispEdges"
                  className="chart-point transition-all duration-150"
                  style={{ animationDelay: `${350 + i * 80}ms` }}
                />

                {/* Review Marker */}
                <rect
                  x={isHovered ? x - 4 : x - 3}
                  y={isHovered ? yReview - 4 : yReview - 3}
                  width={isHovered ? 8 : 6}
                  height={isHovered ? 8 : 6}
                  fill={isHovered ? '#ffffff' : '#eab308'}
                  stroke={isHovered ? '#eab308' : '#121124'}
                  strokeWidth={isHovered ? 2 : 1}
                  shapeRendering="crispEdges"
                  className="chart-point transition-all duration-150"
                  style={{ animationDelay: `${380 + i * 80}ms` }}
                />

                {/* Blocked Marker */}
                <rect
                  x={isHovered ? x - 4 : x - 3}
                  y={isHovered ? yBlocked - 4 : yBlocked - 3}
                  width={isHovered ? 8 : 6}
                  height={isHovered ? 8 : 6}
                  fill={isHovered ? '#ffffff' : '#ef4444'}
                  stroke={isHovered ? '#ef4444' : '#121124'}
                  strokeWidth={isHovered ? 2 : 1}
                  shapeRendering="crispEdges"
                  className="chart-point transition-all duration-150"
                  style={{ animationDelay: `${410 + i * 80}ms` }}
                />

                {/* Day Label */}
                <text
                  x={x}
                  y={chartHeight - 6}
                  textAnchor="middle"
                  fill={isHovered ? '#ffffff' : '#d5d0f5'}
                  fontSize={isHovered ? '13' : '12'}
                  fontWeight={isHovered ? '700' : '600'}
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  className="transition-all duration-150"
                >
                  {d.day}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Chart Legend */}
      <div className="flex items-center justify-center gap-6 pt-2.5 border-t border-[#25204c] text-xs font-semibold">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#22c55e] rounded-xs shadow-xs" />
          <span className="text-[#e2e0f8]">Allowed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#eab308] rounded-xs shadow-xs" />
          <span className="text-[#e2e0f8]">Review</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-[#ef4444] rounded-xs shadow-xs" />
          <span className="text-[#e2e0f8]">Blocked</span>
        </div>
      </div>
    </PixelCard>
  );
};
