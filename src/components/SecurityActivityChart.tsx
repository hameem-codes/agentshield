import React, { useState } from 'react';
import { PixelLightningIcon, PixelInfoIcon } from './pixel/PixelIcons';
import { PixelCard } from './pixel/PixelCard';
import { ChevronDown, Check } from 'lucide-react';

interface DayData {
  day: string;
  allowed: number;
  review: number;
  blocked: number;
}

export const SecurityActivityChart: React.FC = () => {
  const [granularity, setGranularity] = useState('Events (Daily)');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<DayData | null>(null);

  // Exact dataset corresponding to the screenshot curve:
  // Allowed climbs from ~380 to ~720 (Tue to Mon)
  // Review stays steady around 80-120
  // Blocked stays low around 35-60
  const data: DayData[] = [
    { day: 'Tue', allowed: 380, review: 85, blocked: 42 },
    { day: 'Wed', allowed: 460, review: 95, blocked: 48 },
    { day: 'Thu', allowed: 390, review: 88, blocked: 40 },
    { day: 'Fri', allowed: 480, review: 105, blocked: 52 },
    { day: 'Sat', allowed: 540, review: 95, blocked: 45 },
    { day: 'Sun', allowed: 570, review: 88, blocked: 40 },
    { day: 'Mon', allowed: 720, review: 125, blocked: 62 },
  ];

  const chartHeight = 135;
  const chartWidth = 460;
  const paddingLeft = 34;
  const paddingRight = 14;
  const paddingTop = 12;
  const paddingBottom = 20;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;
  const maxY = 800;

  const getY = (val: number) => paddingTop + innerHeight - (val / maxY) * innerHeight;
  const getX = (index: number) => paddingLeft + (index / (data.length - 1)) * innerWidth;

  const buildPath = (key: 'allowed' | 'review' | 'blocked') => {
    return data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(d[key])}`).join(' ');
  };

  const allowedPath = buildPath('allowed');
  const reviewPath = buildPath('review');
  const blockedPath = buildPath('blocked');
  const allowedArea = `${allowedPath} L ${getX(data.length - 1)} ${getY(0)} L ${getX(0)} ${getY(0)} Z`;

  return (
    <PixelCard innerClassName="p-3.5 justify-between h-full">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#25204c]">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center text-yellow-400">
            <PixelLightningIcon size={16} />
          </div>
          <h3 className="text-[13.5px] font-bold text-white tracking-tight">
            Security Activity
          </h3>
          <button
            title="Activity reflects event evaluation decisions over the selected period"
            className="text-[#7d77a8] hover:text-[#c4bbf0] transition-colors ml-0.5"
          >
            <PixelInfoIcon size={13} />
          </button>
        </div>

        {/* Dropdown filter */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-medium text-white bg-[#221f45] border border-[#39316d] rounded-md hover:border-[#52479e] transition-colors shadow-xs"
          >
            <span>{granularity}</span>
            <ChevronDown size={12} className="text-[#9690c2]" />
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

      {/* Interactive Chart Area */}
      <div className="relative w-full my-auto overflow-hidden">
        {/* Tooltip */}
        {hoveredPoint && (
          <div className="absolute top-0 right-2 z-20 px-2 py-1 bg-[#14122b]/95 border border-[#483e84] rounded-md shadow-lg text-[10.5px] flex items-center gap-2.5">
            <span className="font-bold text-white">{hoveredPoint.day}:</span>
            <span className="text-[#22c55e] font-semibold">{hoveredPoint.allowed} Allowed</span>
            <span className="text-[#eab308] font-semibold">{hoveredPoint.review} Review</span>
            <span className="text-[#ef4444] font-semibold">{hoveredPoint.blocked} Blocked</span>
          </div>
        )}

        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-auto overflow-visible select-none"
          shapeRendering="geometricPrecision"
        >
          {/* Y Axis Gridlines and Labels */}
          {[800, 600, 400, 200, 0].map((val) => {
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
                  x={paddingLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  fill="#7872a3"
                  fontSize="9"
                  fontWeight="500"
                  fontFamily="'Pixelify Sans', 'VT323', monospace"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Area under Allowed line */}
          <path d={allowedArea} fill="rgba(34, 197, 94, 0.12)" className="chart-area" />

          {/* Allowed Line (Green) */}
          <path
            d={allowedPath}
            fill="none"
            stroke="#22c55e"
            strokeWidth="2"
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
            strokeWidth="2"
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
            strokeWidth="2"
            strokeLinecap="square"
            strokeLinejoin="round"
            pathLength={1}
            className="chart-line"
            style={{ animationDelay: '260ms' }}
          />

          {/* Square Pixel Markers */}
          {data.map((d, i) => {
            const x = getX(i);
            const yAllowed = getY(d.allowed);
            const yReview = getY(d.review);
            const yBlocked = getY(d.blocked);

            return (
              <g
                key={d.day}
                className="cursor-pointer"
                onMouseEnter={() => setHoveredPoint(d)}
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <rect
                  x={x - 12}
                  y={paddingTop}
                  width="24"
                  height={innerHeight}
                  fill="transparent"
                />

                {/* Allowed Marker */}
                <rect
                  x={x - 2.5}
                  y={yAllowed - 2.5}
                  width="5"
                  height="5"
                  fill="#22c55e"
                  stroke="#121124"
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                  className="chart-point"
                  style={{ animationDelay: `${350 + i * 80}ms` }}
                />

                {/* Review Marker */}
                <rect
                  x={x - 2.5}
                  y={yReview - 2.5}
                  width="5"
                  height="5"
                  fill="#eab308"
                  stroke="#121124"
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                  className="chart-point"
                  style={{ animationDelay: `${380 + i * 80}ms` }}
                />

                {/* Blocked Marker */}
                <rect
                  x={x - 2.5}
                  y={yBlocked - 2.5}
                  width="5"
                  height="5"
                  fill="#ef4444"
                  stroke="#121124"
                  strokeWidth="1"
                  shapeRendering="crispEdges"
                  className="chart-point"
                  style={{ animationDelay: `${410 + i * 80}ms` }}
                />

                {/* Day Label */}
                <text
                  x={x}
                  y={chartHeight - 4}
                  textAnchor="middle"
                  fill="#8c85bd"
                  fontSize="9.5"
                  fontWeight="500"
                  fontFamily="'Pixelify Sans', 'VT323', monospace"
                >
                  {d.day}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Bottom Chart Legend */}
      <div className="flex items-center justify-center gap-5 pt-2 border-t border-[#25204c] text-[11px] font-medium">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#22c55e] rounded-xs shadow-xs" />
          <span className="text-[#a49ecc]">Allowed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#eab308] rounded-xs shadow-xs" />
          <span className="text-[#a49ecc]">Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 bg-[#ef4444] rounded-xs shadow-xs" />
          <span className="text-[#a49ecc]">Blocked</span>
        </div>
      </div>
    </PixelCard>
  );
};
