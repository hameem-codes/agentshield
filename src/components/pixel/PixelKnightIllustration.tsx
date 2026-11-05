import React from 'react';

/**
 * Custom 16-bit Retro Pixel-Art Knight & Island Illustration
 * Generated specifically for the AgentShield sidebar space:
 * - Standalone pixel-art illustration with NO UI buttons, text, or duplicate controls
 * - Heroic knight in silver armor with billowing royal purple cape/flag facing right
 * - Floating grass island with rocky stalactite underside and side bush
 * - Layered purple night clouds across midnight-indigo sky
 * - Seamless top & bottom alpha masks to blend smoothly into the sidebar theme
 */
export const PixelKnightIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`relative w-full h-[225px] select-none overflow-hidden flex items-center justify-center ${className}`}
      style={{
        maskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 10%, black 20%, black 90%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.7) 10%, black 20%, black 90%, transparent 100%)',
      }}
    >
      <img
        src="/illustrations/pixel-knight.jpg"
        alt="AgentShield Knight on Floating Island"
        className="w-full h-full object-cover pixelated pointer-events-none drop-shadow-[0_4px_16px_rgba(109,62,232,0.3)]"
        style={{
          imageRendering: 'pixelated',
          objectPosition: 'center 40%',
        }}
      />
    </div>
  );
};
