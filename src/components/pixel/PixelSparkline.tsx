import React from 'react';

interface PixelSparklineProps {
  color: 'purple' | 'green' | 'yellow' | 'red';
  data: number[];
  width?: number;
  height?: number;
  className?: string;
}

export const PixelSparkline: React.FC<PixelSparklineProps> = ({
  color,
  data,
  width = 96,
  height = 36,
  className = '',
}) => {
  const colorMap = {
    purple: {
      line: '#a855f7',
      fill: 'rgba(168, 85, 247, 0.15)',
      point: '#c084fc',
    },
    green: {
      line: '#22c55e',
      fill: 'rgba(34, 197, 94, 0.15)',
      point: '#4ade80',
    },
    yellow: {
      line: '#eab308',
      fill: 'rgba(234, 179, 8, 0.15)',
      point: '#fde047',
    },
    red: {
      line: '#ef4444',
      fill: 'rgba(239, 68, 68, 0.15)',
      point: '#f87171',
    },
  };

  const { line, fill } = colorMap[color];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  // Compute points with stepped coordinates
  const stepX = width / (data.length - 1);
  const points = data.map((d, i) => {
    const x = Math.round(i * stepX);
    // Invert y: highest value near y=4, lowest near y=height-4
    const y = Math.round(height - 4 - ((d - min) / range) * (height - 10));
    return { x, y };
  });

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
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={`pixelated overflow-visible ${className}`}
      shapeRendering="crispEdges"
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

      {/* Stepped pixel point markers along the path */}
      {points.map((p, idx) => (
        <rect
          key={idx}
          x={p.x - 1.5}
          y={p.y - 1.5}
          width={3}
          height={3}
          fill={line}
          className="chart-point"
          style={{ animationDelay: `${320 + idx * 45}ms` }}
        />
      ))}
    </svg>
  );
};

