import React, { useState } from 'react';
import {
  PixelShieldIcon,
  PixelHouseIcon,
  PixelLayersIcon,
  PixelClipboardCheckIcon,
  PixelSlidersIcon,
  PixelBarChartIcon,
} from './pixel/PixelIcons';
import { PixelKnightIllustration } from './pixel/PixelKnightIllustration';
import { AnimatedNumber } from './pixel/AnimatedNumber';
import { ChevronDown, Check, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  isCollapsed = false,
  onToggleCollapse,
  isOpenMobile = false,
  onCloseMobile,
}) => {
  const [envOpen, setEnvOpen] = useState(false);
  const [currentEnv, setCurrentEnv] = useState<'Development' | 'Staging' | 'Production'>('Development');

  const navItems = [
    { id: 'Overview', label: 'Overview', icon: PixelHouseIcon },
    { id: 'Events', label: 'Events', icon: PixelLayersIcon },
    { id: 'Review', label: 'Review', icon: PixelClipboardCheckIcon, badge: 6 },
    { id: 'Policies', label: 'Policies & Agents', icon: PixelSlidersIcon },
    { id: 'Benchmarks', label: 'Benchmarks', icon: PixelBarChartIcon },
  ];

  const environments = ['Development', 'Staging', 'Production'] as const;

  return (
    <>
      {/* Mobile Backdrop with smooth fade */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-300 ease-in-out ${
          isOpenMobile ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onCloseMobile}
      />

      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex flex-col bg-[#121124] border-r border-[#2e285a] transition-[width,transform] duration-300 ease-in-out ${
          isCollapsed ? 'w-[72px]' : 'w-[272px]'
        } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} lg:transform-none`}
      >
        {/* BRANDING SECTION */}
        <div className="flex items-center h-[68px] px-3 border-b border-[#221e42] relative flex-shrink-0">
          <div
            onClick={isCollapsed && onToggleCollapse ? onToggleCollapse : undefined}
            className={`flex items-center min-w-0 ${isCollapsed ? 'cursor-pointer' : ''}`}
            title={isCollapsed ? 'Click to expand sidebar' : undefined}
          >
            {/* Stable Shield icon container anchored at center 36px */}
            <div className="flex-shrink-0 w-12 h-11 flex items-center justify-center drop-shadow-[0_0_8px_rgba(112,62,232,0.4)]">
              <PixelShieldIcon size={32} />
            </div>

            {/* Smoothly collapsing text */}
            <div
              className={`flex flex-col whitespace-nowrap overflow-hidden transition-[max-width,opacity] ease-out ${
                isCollapsed
                  ? 'opacity-0 max-w-0 pointer-events-none duration-100'
                  : 'opacity-100 max-w-[155px] duration-200 delay-150'
              }`}
            >
              <span className="text-[17px] font-bold tracking-tight text-white flex items-center gap-1">
                AgentShield
              </span>
              <span className="text-[11px] font-medium text-[#938ec0] tracking-wide">
                AI Agent Runtime Security
              </span>
            </div>
          </div>

          {/* Desktop Collapse / Expand Toggle Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`hidden lg:flex items-center justify-center w-7 h-7 text-[#8780b8] hover:text-white hover:bg-[#1f1b3d] rounded-lg transition-all flex-shrink-0 ml-auto ${
                isCollapsed
                  ? 'opacity-0 pointer-events-none max-w-0 overflow-hidden duration-100'
                  : 'opacity-100 duration-200 delay-150'
              }`}
            >
              <ChevronLeft size={17} />
            </button>
          )}
        </div>

        {/* NAVIGATION ITEMS */}
        <nav className="flex flex-col gap-1.5 px-3 py-4 flex-shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            return (
              <div key={item.id} className="relative group">
                <button
                  onClick={() => {
                    onSelectTab(item.id);
                    if (onCloseMobile) onCloseMobile();
                  }}
                  className={`relative flex items-center w-full h-11 rounded-xl font-medium text-[13.5px] overflow-hidden transition-colors duration-200 ${
                    isActive
                      ? 'bg-[#6d3ee8] text-white shadow-[0_2px_12px_rgba(109,62,232,0.45)]'
                      : 'text-[#9c96c9] hover:text-white hover:bg-[#1d1a3a]'
                  }`}
                >
                  {/* Stable fixed-width icon anchor: center remains identical at 36px in both states */}
                  <div className="flex-shrink-0 w-12 h-11 flex items-center justify-center">
                    <span
                      className={`flex items-center justify-center transition-colors ${
                        isActive ? 'text-white' : 'text-[#8780b8] group-hover:text-white'
                      }`}
                    >
                      <Icon size={18} />
                    </span>
                  </div>

                  {/* Smooth text label & badge container */}
                  <div
                    className={`flex items-center justify-between flex-1 min-w-0 overflow-hidden whitespace-nowrap transition-[max-width,opacity,padding] ease-out ${
                      isCollapsed
                        ? 'opacity-0 max-w-0 pr-0 pointer-events-none duration-100'
                        : 'opacity-100 max-w-[200px] pr-3 duration-200 delay-150'
                    }`}
                  >
                    <span className="truncate">{item.label}</span>
                    {item.badge !== undefined && (
                      <span
                        className={`ml-2 px-2 py-0.5 text-[11px] font-bold rounded-md flex-shrink-0 ${
                          isActive
                            ? 'bg-[#5527ca] text-white'
                            : 'bg-[#6d3ee8] text-white shadow-[0_1px_4px_rgba(109,62,232,0.4)]'
                        }`}
                      >
                        <AnimatedNumber value={item.badge} />
                      </span>
                    )}
                  </div>

                  {/* Collapsed dot badge */}
                  {item.badge !== undefined && (
                    <span
                      className={`absolute top-2 right-2 w-2 h-2 rounded-full bg-[#6d3ee8] ring-2 ring-[#121124] transition-opacity ease-out ${
                        isCollapsed ? 'opacity-100 duration-150 delay-150' : 'opacity-0 pointer-events-none duration-100'
                      }`}
                    />
                  )}
                </button>

                {/* Collapsed Tooltip on Hover */}
                {isCollapsed && (
                  <div className="absolute left-full ml-3.5 top-1/2 -translate-y-1/2 z-50 px-2.5 py-1.5 bg-[#181636] border border-[#3e3678] rounded-lg shadow-xl text-xs font-semibold text-white whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {item.label} {item.badge ? `(${item.badge})` : ''}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* SPACER */}
        <div className="flex-1 min-h-[10px]" />

        {/* PIXEL-ART KNIGHT ILLUSTRATION */}
        <div
          className={`relative w-full overflow-hidden mt-auto flex-shrink-0 transition-[max-height,opacity] ease-out ${
            isCollapsed
              ? 'opacity-0 max-h-0 pointer-events-none duration-100'
              : 'opacity-100 max-h-[300px] duration-200 delay-150'
          }`}
        >
          <PixelKnightIllustration />
        </div>

        {/* FOOTER SECTION: ENVIRONMENT SELECTOR & VERSION */}
        <div className="px-3 pt-1 pb-4 flex-shrink-0 border-t border-[#221e42]/60 overflow-hidden">
          {/* Expanded Environment Dropdown */}
          <div
            className={`relative overflow-hidden transition-[max-height,opacity] ease-out ${
              isCollapsed
                ? 'opacity-0 max-h-0 pointer-events-none duration-100'
                : 'opacity-100 max-h-[140px] duration-200 delay-150'
            }`}
          >
            <button
              onClick={() => setEnvOpen(!envOpen)}
              className="flex items-center justify-between w-full px-3 py-2 bg-[#1b1935] border border-[#342d63] rounded-xl hover:bg-[#232044] transition-colors text-[13px] text-white font-medium shadow-sm"
            >
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22c55e]"></span>
                </span>
                <span>{currentEnv}</span>
              </div>
              <ChevronDown
                size={15}
                className={`text-[#9892c5] transition-transform duration-200 ${
                  envOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {/* Dropdown Menu */}
            {envOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-2 p-1 bg-[#191733] border border-[#3c3475] rounded-xl shadow-xl z-50">
                {environments.map((env) => (
                  <button
                    key={env}
                    onClick={() => {
                      setCurrentEnv(env);
                      setEnvOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                      currentEnv === env
                        ? 'bg-[#6d3ee8] text-white'
                        : 'text-[#a9a3d4] hover:bg-[#232047] hover:text-white'
                    }`}
                  >
                    <span>{env}</span>
                    {currentEnv === env && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 px-1 text-[11px] font-mono font-medium text-[#645e8a]">
              V0.3.0
            </div>
          </div>

          {/* Collapsed Indicator & Quick Expand */}
          <div
            className={`flex flex-col items-center justify-center gap-2 overflow-hidden transition-[max-height,opacity] ease-out ${
              isCollapsed
                ? 'opacity-100 max-h-[80px] py-2 duration-150 delay-150'
                : 'opacity-0 max-h-0 pointer-events-none duration-100'
            }`}
          >
            {onToggleCollapse && (
              <button
                onClick={onToggleCollapse}
                title="Expand sidebar"
                className="w-8 h-8 flex items-center justify-center text-[#8780b8] hover:text-white hover:bg-[#1f1b3d] rounded-lg transition-colors"
              >
                <ChevronRight size={17} />
              </button>
            )}
            <span className="relative flex h-2.5 w-2.5" title={`Environment: ${currentEnv}`}>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#22c55e]"></span>
            </span>
            <span className="text-[10px] font-mono font-medium text-[#645e8a]">V0.3</span>
          </div>
        </div>
      </aside>
    </>
  );
};
