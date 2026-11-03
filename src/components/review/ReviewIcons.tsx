import React from 'react';

export const PixelHourglassIcon: React.FC<{ size?: number; className?: string }> = ({ size = 18, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`} shapeRendering="crispEdges">
    {/* Top bar */}
    <rect x="2" y="1" width="12" height="2" />
    {/* Upper glass taper */}
    <rect x="3" y="3" width="10" height="2" />
    <rect x="4" y="5" width="8" height="2" />
    <rect x="6" y="7" width="4" height="2" />
    {/* Lower glass taper */}
    <rect x="4" y="9" width="8" height="2" />
    <rect x="3" y="11" width="10" height="2" />
    {/* Bottom bar */}
    <rect x="2" y="13" width="12" height="2" />
    {/* Sand in center/bottom */}
    <rect x="7" y="8" width="2" height="1" fill="#fde047" />
    <rect x="6" y="11" width="4" height="2" fill="#fde047" />
  </svg>
);

export const PixelGlobeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`pixelated ${className}`}>
    <circle cx="8" cy="8" r="6" />
    <line x1="2" y1="8" x2="14" y2="8" />
    <ellipse cx="8" cy="8" rx="3" ry="6" />
  </svg>
);

export const PixelDatabaseIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`} shapeRendering="crispEdges">
    {/* Disk 1 (top) */}
    <rect x="3" y="1" width="10" height="2" />
    <rect x="2" y="3" width="12" height="1" />
    {/* Disk 2 (mid) */}
    <rect x="3" y="6" width="10" height="2" />
    <rect x="2" y="8" width="12" height="1" />
    {/* Disk 3 (bottom) */}
    <rect x="3" y="11" width="10" height="2" />
    <rect x="2" y="13" width="12" height="1" />
  </svg>
);

export const PixelMailIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`} shapeRendering="crispEdges">
    <rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <rect x="4" y="5" width="2" height="1" />
    <rect x="10" y="5" width="2" height="1" />
    <rect x="6" y="6" width="4" height="1" />
    <rect x="7" y="7" width="2" height="1" />
  </svg>
);

export const PixelCodeIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`} shapeRendering="crispEdges">
    {/* Left < */}
    <rect x="4" y="5" width="2" height="2" />
    <rect x="2" y="7" width="2" height="2" />
    <rect x="4" y="9" width="2" height="2" />
    {/* Slash / */}
    <rect x="7" y="9" width="2" height="2" />
    <rect x="8" y="7" width="2" height="2" />
    <rect x="9" y="5" width="2" height="2" />
    {/* Right > */}
    <rect x="11" y="5" width="2" height="2" />
    <rect x="13" y="7" width="2" height="2" />
    <rect x="11" y="9" width="2" height="2" />
  </svg>
);

export const PixelPencilIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`} shapeRendering="crispEdges">
    <rect x="11" y="2" width="2" height="2" />
    <rect x="9" y="4" width="3" height="3" />
    <rect x="7" y="6" width="3" height="3" />
    <rect x="5" y="8" width="3" height="3" />
    <rect x="3" y="10" width="3" height="3" />
    <rect x="2" y="13" width="2" height="2" />
  </svg>
);

export const PixelDownloadIcon: React.FC<{ size?: number; className?: string }> = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={`pixelated ${className}`} shapeRendering="crispEdges">
    {/* Arrow shaft */}
    <rect x="7" y="2" width="2" height="7" />
    {/* Arrow head */}
    <rect x="5" y="7" width="2" height="2" />
    <rect x="9" y="7" width="2" height="2" />
    <rect x="6" y="9" width="4" height="1" />
    {/* Base line */}
    <rect x="2" y="12" width="12" height="2" />
  </svg>
);

