import React from "react";

export interface PathStop {
  id: number;
  label: string;
  description: string;
  category?: "proposal" | "security" | "execution" | "audit";
}

interface WindingPathProps {
  stops: PathStop[];
  activeStopIndex?: number;
  onSelectStop?: (stop: PathStop, index: number) => void;
}

export const WindingPath: React.FC<WindingPathProps> = ({
  stops,
  activeStopIndex = 0,
  onSelectStop,
}) => {
  // Path requested:
  // viewBox 0 0 1140 1090
  // d="M140,190 C600,170 960,150 990,300 C1020,450 780,470 520,480 C250,490 80,540 110,680 C140,820 600,760 900,800 C1010,815 1030,900 960,960"
  // 3 strokes: grey outline 74, black 64, cream 56 + dashed ink stroke (dasharray "1.5 52") for tile dividers
  // Stops at (462,178) (990,300) (520,480) (202,531) (404,777) (900,800) (960,960)
  // Numbered circles, varied stage labels (italic, vertical, letter-spaced), START flag at beginning
  const curveD =
    "M140,190 C600,170 960,150 990,300 C1020,450 780,470 520,480 C250,490 80,540 110,680 C140,820 600,760 900,800 C1010,815 1030,900 960,960";

  const stopCoords = [
    { x: 462, y: 178, labelX: 462, labelY: 130, align: "middle", style: "italic" },
    { x: 990, y: 300, labelX: 1040, labelY: 305, align: "start", style: "vertical" },
    { x: 520, y: 480, labelX: 520, labelY: 535, align: "middle", style: "spaced" },
    { x: 202, y: 531, labelX: 145, labelY: 535, align: "end", style: "italic" },
    { x: 404, y: 777, labelX: 404, labelY: 835, align: "middle", style: "bold" },
    { x: 900, y: 800, labelX: 900, labelY: 755, align: "middle", style: "spaced" },
    { x: 960, y: 960, labelX: 960, labelY: 1015, align: "middle", style: "vertical" },
  ];

  return (
    <div className="w-full relative overflow-visible select-none">
      <svg
        viewBox="0 0 1140 1090"
        className="w-full h-auto drop-shadow-2xl overflow-visible"
        style={{ maxWidth: "100%" }}
      >
        <defs>
          <filter id="chipShadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="4" dy="4" stdDeviation="0" floodColor="#000000" />
          </filter>
        </defs>

        {/* 1. Grey outline: width 74 */}
        <path
          d={curveD}
          fill="none"
          stroke="#4a473d"
          strokeWidth="74"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 2. Black stroke: width 64 */}
        <path
          d={curveD}
          fill="none"
          stroke="#000000"
          strokeWidth="64"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 3. Cream core fill: width 56 */}
        <path
          d={curveD}
          fill="none"
          stroke="#f4ecd0"
          strokeWidth="56"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* 4. Dashed ink stroke for tile dividers: dasharray "1.5 52" */}
        <path
          d={curveD}
          fill="none"
          stroke="#17150d"
          strokeWidth="56"
          strokeDasharray="1.5 52"
          strokeLinecap="butt"
          strokeLinejoin="round"
          opacity="0.85"
        />

        {/* START flag at (140, 190) */}
        <g transform="translate(100, 130)">
          {/* Flag pole */}
          <line x1="20" y1="10" x2="20" y2="70" stroke="#000000" strokeWidth="4" strokeLinecap="round" />
          <line x1="20" y1="10" x2="20" y2="70" stroke="#f4ecd0" strokeWidth="2" strokeLinecap="round" />
          {/* Flag banner */}
          <polygon
            points="22,12 85,26 22,40"
            fill="#ff8fb1"
            stroke="#000000"
            strokeWidth="3"
            style={{ filter: "drop-shadow(3px 3px 0px #000000)" }}
          />
          <text
            x="36"
            y="29"
            fill="#17150d"
            fontFamily="'Archivo', sans-serif"
            fontWeight="900"
            fontStyle="italic"
            fontSize="10"
            letterSpacing="1px"
          >
            START
          </text>
        </g>

        {/* 7 Numbered Stops */}
        {stops.map((stop, idx) => {
          const coord = stopCoords[idx] || {
            x: 200 + idx * 100,
            y: 200,
            labelX: 200 + idx * 100,
            labelY: 240,
            align: "middle",
            style: "italic",
          };
          const isSelected = idx === activeStopIndex;

          return (
            <g
              key={stop.id}
              className="cursor-pointer group"
              onClick={() => onSelectStop && onSelectStop(stop, idx)}
            >
              {/* Outer selection ring if active */}
              {isSelected && (
                <circle
                  cx={coord.x}
                  cy={coord.y}
                  r="30"
                  fill="none"
                  stroke="#ff8fb1"
                  strokeWidth="4"
                  strokeDasharray="4 3"
                />
              )}

              {/* Stop Numbered Circle with 3px black border & 4px offset shadow */}
              <circle
                cx={coord.x + 3}
                cy={coord.y + 3}
                r="20"
                fill="#000000"
              />
              <circle
                cx={coord.x}
                cy={coord.y}
                r="20"
                fill={isSelected ? "#ff8fb1" : "#f4ecd0"}
                stroke="#000000"
                strokeWidth="3.5"
                className="transition-colors duration-200 group-hover:fill-[#ff8fb1]"
              />

              {/* Number */}
              <text
                x={coord.x}
                y={coord.y + 7}
                textAnchor="middle"
                fill="#17150d"
                fontFamily="'Archivo', sans-serif"
                fontWeight="900"
                fontStyle="italic"
                fontSize="18"
              >
                {stop.id}
              </text>

              {/* Stage label with varied typographical treatments */}
              {coord.style === "vertical" ? (
                <text
                  x={coord.labelX}
                  y={coord.labelY}
                  textAnchor="middle"
                  fill={isSelected ? "#ff8fb1" : "#f4ecd0"}
                  fontFamily="'Archivo', sans-serif"
                  fontWeight="900"
                  fontStyle="italic"
                  fontSize="15"
                  letterSpacing="3px"
                  style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
                  className="transition-colors group-hover:fill-[#ff8fb1]"
                >
                  {stop.label.toUpperCase()}
                </text>
              ) : coord.style === "spaced" ? (
                <text
                  x={coord.labelX}
                  y={coord.labelY}
                  textAnchor={coord.align as "start" | "middle" | "end"}
                  fill={isSelected ? "#ff8fb1" : "#f4ecd0"}
                  fontFamily="'Archivo', sans-serif"
                  fontWeight="800"
                  fontSize="15"
                  letterSpacing="4px"
                  className="transition-colors group-hover:fill-[#ff8fb1]"
                >
                  {stop.label.toUpperCase()}
                </text>
              ) : (
                <text
                  x={coord.labelX}
                  y={coord.labelY}
                  textAnchor={coord.align as "start" | "middle" | "end"}
                  fill={isSelected ? "#ff8fb1" : "#f4ecd0"}
                  fontFamily="'Archivo', sans-serif"
                  fontWeight="900"
                  fontStyle="italic"
                  fontSize="16"
                  letterSpacing="1px"
                  className="transition-colors group-hover:fill-[#ff8fb1]"
                >
                  {stop.label.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
