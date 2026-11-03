import React from 'react';
import { PixelHeaderBackdrop } from '../pixel/PixelHeaderBackdrop';
import { Shield, Bot } from 'lucide-react';

interface PolicyPageHeaderProps {
  activeMainTab: 'Policies' | 'Agents';
  onSelectMainTab: (tab: 'Policies' | 'Agents') => void;
}

export const PolicyPageHeader: React.FC<PolicyPageHeaderProps> = ({
  activeMainTab,
  onSelectMainTab,
}) => {
  return (
    <div className="relative pt-1 pb-3 select-none">
      {/* Pixel-art background scene (Sunset Moon, Castle & Towers) */}
      <div className="absolute top-0 right-36 left-[300px] h-20 hidden lg:block opacity-95 overflow-hidden pointer-events-none">
        <PixelHeaderBackdrop className="w-full h-full" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* LEFT: TITLE & SUBTITLE */}
        <div>
          <h2 className="text-[26px] md:text-[28px] font-bold text-white tracking-tight leading-tight">
            Policies & Agents
          </h2>
          <p className="text-[13.5px] font-medium text-[#938ebf] mt-0.5">
            Manage security policies and agent access in one place.
          </p>
        </div>

        {/* RIGHT: MAIN TABS (POLICIES / AGENTS) */}
        <div className="flex items-center gap-1.5 p-1 bg-[#16142e] border border-[#372f6a] rounded-xl self-start md:self-auto relative z-20 shadow-sm">
          <button
            onClick={() => onSelectMainTab('Policies')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              activeMainTab === 'Policies'
                ? 'bg-[#6d3ee8] text-white shadow-[0_2px_10px_rgba(109,62,232,0.4)]'
                : 'text-[#9c96c9] hover:text-white hover:bg-[#1d1a3a]'
            }`}
          >
            <Shield size={14} />
            <span>Policies</span>
          </button>

          <button
            onClick={() => onSelectMainTab('Agents')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
              activeMainTab === 'Agents'
                ? 'bg-[#6d3ee8] text-white shadow-[0_2px_10px_rgba(109,62,232,0.4)]'
                : 'text-[#9c96c9] hover:text-white hover:bg-[#1d1a3a]'
            }`}
          >
            <Bot size={14} />
            <span>Agents</span>
          </button>
        </div>
      </div>
    </div>
  );
};

