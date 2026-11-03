import React, { useState } from 'react';

interface PixelSparklineProps {
  color: 'purple' | 'green' | 'yellow' | 'red';
  data: number[];
  width?: number;
  height?: number;
  className?: string;
  valueSuffix?: string;
}

export const PixelSparkline: React.FC<PixelSparklineProps> = ({
  color,
  data,
  width = 108,
  height = 36,
  className = '',
  valueSuffix = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const colorMap = {
    purple: {
      line: '#a855f7',
      fill: 'rgba(168, 85, 247, 0.22)',
      point: '#c084fc',
      badgeBg: 'bg-purple-950/90',
      badgeBorder: 'border-purple-500/50',
      badgeText: 'text-purple-300',
    },
    green: {
      line: '#22c55e',
      fill: 'rgba(34, 197, 94, 0.22)',
      point: '#4ade80',
      badgeBg: 'bg-emerald-950/90',
      badgeBorder: 'border-emerald-500/50',
      badgeText: 'text-emerald-300',
    },
    yellow: {
      line: '#eab308',
      fill: 'rgba(234, 179, 8, 0.22)',
      point: '#fde047',
      badgeBg: 'bg-amber-950/90',
      badgeBorder: 'border-amber-500/50',
      badgeText: 'text-amber-300',
    },
    red: {
      line: '#ef4444',
      fill: 'rgba(239, 68, 68, 0.22)',
      point: '#f87171',
      badgeBg: 'bg-rose-950/90',
      badgeBorder: 'border-rose-500/50',
      badgeText: 'text-rose-300',
    },
  };

  const { line, fill, badgeBg, badgeBorder, badgeText } = colorMap[color];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Compute points with stepped coordinates
  const stepX = (width - 8) / (data.length - 1);
  const points = data.map((d, i) => {
    const x = Math.round(4 + i * stepX);
    const y = Math.round(height - 4 - ((d - min) / range) * (height - 10));
    return { x, y, value: d };
  });

  // Continuous mouse tracking across sparkline width
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const norm = (mouseX - 4) / (rect.width - 8);
    const idx = Math.max(0, Math.min(data.length - 1, Math.round(norm * (data.length - 1))));
    setHoveredIdx(idx);
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
  };

  // Build stepped path: horizontal step to next x, then vertical to next y
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = Math.round((prev.x + curr.x) / 2);
    pathD += ` L ${midX} ${prev.y} L ${midX} ${curr.y} L ${curr.x} ${curr.y}`;
  }

  const fillD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className={`relative inline-block select-none ${className}`}>
      {/* Floating Hover Tooltip */}
      {hoveredIdx !== null && (
        <div
          className={`absolute -top-7 z-30 px-2 py-0.5 text-[11.5px] font-mono font-bold rounded-md border shadow-xl whitespace-nowrap transition-transform duration-100 pointer-events-none ${badgeBg} ${badgeBorder} ${badgeText}`}
          style={{
            left: `${points[hoveredIdx].x}px`,
            transform:
              hoveredIdx === 0
                ? 'translateX(0%)'
                : hoveredIdx === data.length - 1
                ? 'translateX(-100%)'
                : 'translateX(-50%)',
          }}
        >
          {points[hoveredIdx].value}
          {valueSuffix}
        </div>
      )}

      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="pixelated overflow-visible cursor-crosshair"
        shapeRendering="crispEdges"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Area under sparkline */}
        <path d={fillD} fill={fill} className="chart-area" />

        {/* Stepped line */}
        <path
          d={pathD}
          fill="none"
          stroke={line}
          strokeWidth="2.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
          pathLength={1}
          className="chart-line"
        />

        {/* Point markers */}
        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          return (
            <rect
              key={idx}
              x={isHovered ? p.x - 2.5 : p.x - 1.5}
              y={isHovered ? p.y - 2.5 : p.y - 1.5}
              width={isHovered ? 5 : 3.5}
              height={isHovered ? 5 : 3.5}
              fill={isHovered ? '#ffffff' : line}
              stroke={isHovered ? line : undefined}
              strokeWidth={isHovered ? 1 : 0}
              className="chart-point pointer-events-none transition-all duration-100"
            />
          );
        })}
      </svg>
    </div>
  );
};
