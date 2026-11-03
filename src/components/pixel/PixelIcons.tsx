import React from 'react';

// Custom crisp pixel-art SVGs (16x16 or 24x24 viewBox with crisp rects/pixel paths)

export const PixelShieldIcon: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`pixelated ${className}`}
  >
    {/* Shield outer border in purple */}
    <path
      d="M3 3H21V11C21 17 12 21 12 21C12 21 3 17 3 11V3Z"
      fill="#282256"
      stroke="#6b5bb8"
      strokeWidth="2"
      shapeRendering="crispEdges"
    />
    {/* Inner shield fill */}
    <path
      d="M5 5H19V11C19 15.5 12 19 12 19C12 19 5 15.5 5 11V5Z"
      fill="#1b173b"
      shapeRendering="crispEdges"
    />
    {/* Pixel Star in Center */}
    <rect x="11" y="8" width="2" height="6" fill="#facc15" shapeRendering="crispEdges" />
    <rect x="9" y="10" width="6" height="2" fill="#facc15" shapeRendering="crispEdges" />
    <rect x="10" y="9" width="4" height="4" fill="#fde047" shapeRendering="crispEdges" />
    <rect x="11" y="10" width="2" height="2" fill="#ffffff" shapeRendering="crispEdges" />
  </svg>
);

export const PixelHouseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`}>
    {/* Roof */}
    <rect x="7" y="1" width="2" height="2" />
    <rect x="5" y="3" width="6" height="2" />
    <rect x="3" y="5" width="10" height="2" />
    <rect x="1" y="7" width="14" height="2" />
    {/* Walls */}
    <rect x="2" y="9" width="12" height="6" />
    {/* Door */}
    <rect x="6" y="10" width="4" height="5" fill="#1b173b" />
  </svg>
);

export const PixelLayersIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`}>
    {/* Top layer diamond */}
    <rect x="7" y="1" width="2" height="1" />
    <rect x="5" y="2" width="6" height="1" />
    <rect x="3" y="3" width="10" height="1" />
    <rect x="5" y="4" width="6" height="1" />
    <rect x="7" y="5" width="2" height="1" />
    {/* Mid layer */}
    <rect x="2" y="7" width="2" height="1" />
    <rect x="12" y="7" width="2" height="1" />
    <rect x="4" y="8" width="8" height="1" />
    <rect x="6" y="9" width="4" height="1" />
    {/* Bottom layer */}
    <rect x="2" y="11" width="2" height="1" />
    <rect x="12" y="11" width="2" height="1" />
    <rect x="4" y="12" width="8" height="1" />
    <rect x="6" y="13" width="4" height="1" />
  </svg>
);

export const PixelClipboardCheckIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`}>
    <rect x="5" y="0" width="6" height="2" />
    <rect x="2" y="2" width="12" height="13" fill="none" stroke="currentColor" strokeWidth="2" shapeRendering="crispEdges" />
    {/* Checkmark */}
    <rect x="5" y="8" width="2" height="2" />
    <rect x="7" y="9" width="2" height="2" />
    <rect x="9" y="7" width="2" height="2" />
    <rect x="10" y="6" width="2" height="2" />
  </svg>
);

export const PixelSlidersIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`}>
    {/* Top slider */}
    <rect x="1" y="3" width="14" height="2" />
    <rect x="4" y="1" width="3" height="6" />
    {/* Bottom slider */}
    <rect x="1" y="10" width="14" height="2" />
    <rect x="9" y="8" width="3" height="6" />
  </svg>
);

export const PixelBarChartIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`}>
    <rect x="1" y="10" width="3" height="5" />
    <rect x="5" y="6" width="3" height="9" />
    <rect x="9" y="3" width="3" height="12" />
    <rect x="13" y="1" width="3" height="14" />
  </svg>
);

export const PixelCheckCircleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="3" y="1" width="10" height="14" fill="#22c55e" />
    <rect x="1" y="3" width="14" height="10" fill="#22c55e" />
    {/* Checkmark in white */}
    <rect x="4" y="8" width="2" height="2" fill="#ffffff" />
    <rect x="6" y="10" width="2" height="2" fill="#ffffff" />
    <rect x="8" y="8" width="2" height="2" fill="#ffffff" />
    <rect x="10" y="6" width="2" height="2" fill="#ffffff" />
    <rect x="11" y="5" width="2" height="2" fill="#ffffff" />
  </svg>
);

export const PixelClockCircleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="3" y="1" width="10" height="14" fill="#eab308" />
    <rect x="1" y="3" width="14" height="10" fill="#eab308" />
    {/* Clock hands in dark/white */}
    <rect x="7" y="4" width="2" height="5" fill="#1b173b" />
    <rect x="8" y="7" width="4" height="2" fill="#1b173b" />
  </svg>
);

export const PixelCrossShieldIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="3" y="1" width="10" height="14" fill="#ef4444" />
    <rect x="1" y="3" width="14" height="10" fill="#ef4444" />
    {/* Cross in white */}
    <rect x="5" y="5" width="2" height="2" fill="#ffffff" />
    <rect x="9" y="5" width="2" height="2" fill="#ffffff" />
    <rect x="6" y="6" width="4" height="4" fill="#ffffff" />
    <rect x="5" y="9" width="2" height="2" fill="#ffffff" />
    <rect x="9" y="9" width="2" height="2" fill="#ffffff" />
  </svg>
);

export const PixelLightningIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="8" y="1" width="3" height="4" fill="#facc15" />
    <rect x="6" y="4" width="4" height="3" fill="#facc15" />
    <rect x="4" y="6" width="7" height="3" fill="#facc15" />
    <rect x="7" y="8" width="3" height="4" fill="#facc15" />
    <rect x="6" y="11" width="2" height="4" fill="#facc15" />
  </svg>
);

export const PixelWarningTriangleIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <path
      d="M7 1H9V3H11V5H13V7H15V13H1V7H3V5H5V3H7V1Z"
      fill="#eab308"
    />
    {/* Exclamation point */}
    <rect x="7" y="5" width="2" height="4" fill="#1e1838" />
    <rect x="7" y="10" width="2" height="2" fill="#1e1838" />
  </svg>
);

export const PixelRobotIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    {/* Antenna */}
    <rect x="7" y="1" width="2" height="1" fill="#818cf8" />
    <rect x="6" y="2" width="4" height="1" fill="#a5b4fc" />
    {/* Head */}
    <rect x="2" y="3" width="12" height="11" fill="#312e81" stroke="#6366f1" strokeWidth="1" shapeRendering="crispEdges" />
    {/* Ears */}
    <rect x="0" y="6" width="2" height="5" fill="#6366f1" />
    <rect x="14" y="6" width="2" height="5" fill="#6366f1" />
    {/* Eyes */}
    <rect x="4" y="6" width="3" height="3" fill="#22d3ee" />
    <rect x="9" y="6" width="3" height="3" fill="#22d3ee" />
    {/* Mouth */}
    <rect x="5" y="11" width="6" height="1" fill="#cbd5e1" />
  </svg>
);

export const PixelPauseBarsIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="4" y="3" width="3" height="10" fill="#f97316" />
    <rect x="9" y="3" width="3" height="10" fill="#f97316" />
  </svg>
);

export const PixelInfoIcon: React.FC<{ size?: number; className?: string }> = ({ size = 15, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
    <rect x="7" y="4" width="2" height="2" fill="currentColor" />
    <rect x="7" y="7" width="2" height="5" fill="currentColor" />
  </svg>
);

export const PixelUsersIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`}>
    <rect x="5" y="2" width="6" height="4" />
    <rect x="3" y="7" width="10" height="7" />
    <rect x="1" y="9" width="3" height="5" opacity="0.6" />
    <rect x="12" y="9" width="3" height="5" opacity="0.6" />
  </svg>
);

export const PixelPlayIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`}>
    <rect x="3" y="2" width="2" height="12" />
    <rect x="5" y="3" width="2" height="10" />
    <rect x="7" y="4" width="2" height="8" />
    <rect x="9" y="5" width="2" height="6" />
    <rect x="11" y="6" width="2" height="4" />
    <rect x="13" y="7" width="2" height="2" />
  </svg>
);

export const PixelDatabaseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="2" y="2" width="12" height="3" fill="#9b95c9" />
    <rect x="3" y="1" width="10" height="1" fill="#9b95c9" />
    <rect x="3" y="5" width="10" height="1" fill="#4d4480" />
    <rect x="2" y="7" width="12" height="3" fill="#9b95c9" />
    <rect x="3" y="10" width="10" height="1" fill="#4d4480" />
    <rect x="2" y="12" width="12" height="3" fill="#9b95c9" />
    <rect x="3" y="15" width="10" height="1" fill="#4d4480" />
  </svg>
);

export const PixelTrendingUpGreenIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="2" y="11" width="2" height="2" fill="#22c55e" />
    <rect x="4" y="9" width="2" height="2" fill="#22c55e" />
    <rect x="6" y="10" width="2" height="2" fill="#22c55e" />
    <rect x="8" y="7" width="2" height="2" fill="#22c55e" />
    <rect x="10" y="5" width="2" height="2" fill="#22c55e" />
    <rect x="12" y="3" width="2" height="2" fill="#22c55e" />
    <rect x="9" y="3" width="5" height="2" fill="#22c55e" />
    <rect x="12" y="5" width="2" height="4" fill="#22c55e" />
  </svg>
);

export const PixelStarShieldBadgeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="3" y="2" width="10" height="8" fill="#eab308" />
    <rect x="4" y="10" width="8" height="2" fill="#eab308" />
    <rect x="6" y="12" width="4" height="2" fill="#eab308" />
    <rect x="7" y="14" width="2" height="1" fill="#eab308" />
    <rect x="7" y="4" width="2" height="6" fill="#1b173b" />
    <rect x="5" y="6" width="6" height="2" fill="#1b173b" />
    <rect x="7" y="6" width="2" height="2" fill="#fef08a" />
  </svg>
);

export const PixelCubeBoxIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="6" y="1" width="4" height="2" fill="#9b95c9" />
    <rect x="3" y="3" width="10" height="2" fill="#9b95c9" />
    <rect x="2" y="5" width="12" height="2" fill="#9b95c9" />
    <rect x="2" y="7" width="5" height="7" fill="#6d659e" />
    <rect x="9" y="7" width="5" height="7" fill="#524a80" />
    <rect x="7" y="7" width="2" height="7" fill="#3b3464" />
  </svg>
);

export const PixelClockOutlineIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`pixelated ${className}`}>
    <rect x="5" y="1" width="6" height="1" fill="#9b95c9" />
    <rect x="3" y="2" width="2" height="1" fill="#9b95c9" />
    <rect x="11" y="2" width="2" height="1" fill="#9b95c9" />
    <rect x="2" y="3" width="1" height="2" fill="#9b95c9" />
    <rect x="13" y="3" width="1" height="2" fill="#9b95c9" />
    <rect x="1" y="5" width="1" height="6" fill="#9b95c9" />
    <rect x="14" y="5" width="1" height="6" fill="#9b95c9" />
    <rect x="2" y="11" width="1" height="2" fill="#9b95c9" />
    <rect x="13" y="11" width="1" height="2" fill="#9b95c9" />
    <rect x="3" y="13" width="2" height="1" fill="#9b95c9" />
    <rect x="11" y="13" width="2" height="1" fill="#9b95c9" />
    <rect x="5" y="14" width="6" height="1" fill="#9b95c9" />
    <rect x="7" y="4" width="2" height="5" fill="#c4bbf0" />
    <rect x="8" y="7" width="4" height="2" fill="#c4bbf0" />
  </svg>
);

