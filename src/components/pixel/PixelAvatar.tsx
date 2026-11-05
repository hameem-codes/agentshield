import React from 'react';

/**
 * Pixel-art administrator avatar
 * 32x32 retro styled character with brown hair, pixel facial details, blue shirt
 */
export const PixelAvatar: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => {
  return (
    <div
      style={{ width: size, height: size }}
      className={`relative rounded-full overflow-hidden border border-[#584e9b] bg-[#1d193d] flex-shrink-0 pixelated ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="w-full h-full pixelated"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
      >
        {/* Background circle is filled by container */}
        
        {/* Hair Back */}
        <rect x="5" y="4" width="14" height="10" fill="#713f12" />
        <rect x="4" y="6" width="16" height="8" fill="#713f12" />
        <rect x="7" y="3" width="10" height="3" fill="#854d0e" />

        {/* Head / Face Skin */}
        <rect x="6" y="7" width="12" height="10" fill="#fed7aa" />
        <rect x="7" y="14" width="10" height="4" fill="#fed7aa" />

        {/* Hair Bangs / Front */}
        <rect x="6" y="5" width="12" height="4" fill="#854d0e" />
        <rect x="5" y="6" width="3" height="6" fill="#713f12" />
        <rect x="16" y="6" width="3" height="6" fill="#713f12" />
        <rect x="8" y="7" width="3" height="3" fill="#a16207" />
        <rect x="12" y="7" width="3" height="2" fill="#a16207" />

        {/* Eyes */}
        <rect x="7" y="10" width="3" height="3" fill="#1e293b" />
        <rect x="8" y="10" width="1" height="1" fill="#ffffff" />
        <rect x="14" y="10" width="3" height="3" fill="#1e293b" />
        <rect x="15" y="10" width="1" height="1" fill="#ffffff" />

        {/* Cheeks / Blush */}
        <rect x="6" y="13" width="2" height="1" fill="#fca5a5" />
        <rect x="16" y="13" width="2" height="1" fill="#fca5a5" />

        {/* Mouth */}
        <rect x="11" y="14" width="2" height="1" fill="#991b1b" />

        {/* Blue Shirt & Collar */}
        <rect x="4" y="18" width="16" height="6" fill="#2563eb" />
        <rect x="9" y="17" width="6" height="3" fill="#fed7aa" />
        <rect x="10" y="19" width="4" height="3" fill="#1d4ed8" />
        <rect x="7" y="19" width="3" height="4" fill="#3b82f6" />
        <rect x="14" y="19" width="3" height="4" fill="#3b82f6" />
      </svg>
    </div>
  );
};

