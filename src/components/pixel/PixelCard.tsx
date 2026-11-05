import React from 'react';

interface PixelCardProps {
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  onClick?: () => void;
}

export const PixelCard: React.FC<PixelCardProps> = ({
  children,
  className = '',
  innerClassName = '',
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`relative p-[1.5px] bg-[#423a7e] hover:bg-[#52499c] pixel-corners shadow-[0_4px_16px_rgba(0,0,0,0.35)] transition-colors duration-150 flex flex-col ${className}`}
    >
      <div
        className={`w-full h-full bg-[#181635] pixel-corners flex flex-col ${innerClassName}`}
      >
        {children}
      </div>
    </div>
  );
};

