import React from 'react';

/**
 * Custom 16-bit Retro Pixel-Art Horizon Landscape
 * Generated specifically for the AgentShield header space:
 * - Standalone panoramic pixel landscape with NO baked-in text or card borders
 * - Setting golden-yellow pixel sun nestled into purple mountain ridges
 * - Drifting purple/lavender clouds across dusk sky
 * - Gothic castle silhouette with lit yellow vertical window slits
 * - Horizontal soft edge fades to integrate seamlessly into the midnight canvas
 */
export const PixelHeaderBackdrop: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={`pointer-events-none select-none overflow-hidden relative ${className}`}
      style={{
        maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 8%, black 20%, black 80%, rgba(0,0,0,0.6) 92%, transparent 100%), linear-gradient(to bottom, black 85%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 8%, black 20%, black 80%, rgba(0,0,0,0.6) 92%, transparent 100%), linear-gradient(to bottom, black 85%, transparent 100%)',
        maskComposite: 'intersect',
        WebkitMaskComposite: 'destination-in',
      }}
    >
      <img
        src="/illustrations/header-landscape.jpg"
        alt="AgentShield Pixel Header Horizon"
        className="w-full h-full object-cover pixelated opacity-95"
        style={{
          imageRendering: 'pixelated',
          objectPosition: 'center 56%',
        }}
      />
    </div>
  );
};
