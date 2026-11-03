import React, { useState } from 'react';
import { Search, Bell, ChevronDown, Menu, Shield, CheckCircle, AlertTriangle, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { PixelAvatar } from './pixel/PixelAvatar';
import { AnimatedNumber } from './pixel/AnimatedNumber';

interface TopNavigationProps {
  title?: string;
  onOpenSearch: () => void;
  onToggleMobileMenu: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const TopNavigation: React.FC<TopNavigationProps> = ({
  title = 'Overview',
  onOpenSearch,
  onToggleMobileMenu,
  isCollapsed = false,
  onToggleCollapse,
}) => {
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <header className="relative z-30 flex items-center justify-between h-[68px] px-6 bg-[#121124] border-b border-[#2e285a]">
      {/* LEFT: TITLE, TOGGLE, & DECORATIVE PIXEL CLOUDS */}
      <div className="flex items-center gap-3">
        {/* Mobile Hamburger */}
        <button
          onClick={onToggleMobileMenu}
          className="p-1.5 text-[#9892c5] hover:text-white rounded-lg hover:bg-[#1f1c3d] lg:hidden"
        >
          <Menu size={22} />
        </button>

        {/* Desktop Sidebar Collapse Toggle */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden lg:flex items-center justify-center p-1.5 text-[#9892c5] hover:text-white rounded-lg hover:bg-[#1f1c3d] transition-colors"
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        )}

        <div className="relative flex items-center">
          <h1 className="text-xl font-bold tracking-tight text-white relative z-10">
            {title}
          </h1>

          {/* Decorative pixel clouds floating behind title */}
          <div className="absolute -top-1 left-24 pointer-events-none select-none opacity-60">
            <svg width="64" height="20" viewBox="0 0 64 20" fill="none" className="pixelated" shapeRendering="crispEdges">
              <rect x="16" y="2" width="28" height="5" fill="#3a3266" />
              <rect x="8" y="7" width="44" height="6" fill="#3a3266" />
              <rect x="2" y="13" width="56" height="5" fill="#2d2752" />
              <rect x="18" y="4" width="20" height="3" fill="#4d4285" />
            </svg>
          </div>
        </div>
      </div>

      {/* RIGHT: SEARCH, NOTIFICATIONS, ADMIN PROFILE */}
      <div className="flex items-center gap-3.5">
        {/* Global Search Bar */}
        <button
          onClick={onOpenSearch}
          className="flex items-center justify-between w-64 md:w-80 h-9 px-3 bg-[#191733] border border-[#342d63] rounded-xl text-xs text-[#8780b8] hover:border-[#52479e] transition-all shadow-inner group"
        >
          <div className="flex items-center gap-2 overflow-hidden text-ellipsis whitespace-nowrap">
            <Search size={14} className="text-[#8780b8] group-hover:text-[#c4bbf0] transition-colors" />
            <span className="text-[12.5px] text-[#7d77a8] group-hover:text-[#aba4db] transition-colors">
              Search events, agents, policies...
            </span>
          </div>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10.5px] font-mono font-medium text-[#9a94cb] bg-[#242047] border border-[#3c3475] rounded-md shadow-xs">
            ⌘ K
          </kbd>
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setAdminMenuOpen(false);
            }}
            className="relative flex items-center justify-center w-9 h-9 bg-[#191733] border border-[#342d63] rounded-xl text-[#9c96c9] hover:text-white hover:border-[#52479e] transition-colors shadow-sm"
          >
            <Bell size={16} />
            {/* Red Notification Pip */}
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#ef4444] rounded-full ring-2 ring-[#121124]" />
          </button>

          {/* Notification Popover */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 p-3 bg-[#181634] border border-[#3e3678] rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between pb-2 border-b border-[#282352]">
                <span className="text-xs font-bold text-white tracking-wide uppercase">Security Alerts</span>
                <button
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[#8881b8] hover:text-white"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex flex-col gap-2 mt-2 max-h-64 overflow-y-auto">
                <div className="p-2.5 rounded-xl bg-[#221e45] border border-[#3c3474] text-xs">
                  <div className="flex items-center justify-between text-[#ef4444] font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle size={13} /> High-Risk Detected
                    </span>
                    <span className="text-[10px] text-[#8680b5]">2m Ago</span>
                  </div>
                  <p className="text-[#c6c2e8] text-[11px] leading-relaxed">
                    Email-Agent triggered policy rule violation (Risk <AnimatedNumber value={87} />).
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-[#1d1a3b] border border-[#312a5e] text-xs">
                  <div className="flex items-center justify-between text-[#eab308] font-semibold mb-1">
                    <span>Awaiting Review</span>
                    <span className="text-[10px] text-[#8680b5]">12m Ago</span>
                  </div>
                  <p className="text-[#c6c2e8] text-[11px] leading-relaxed">
                    <AnimatedNumber value={6} /> file access requests currently queued for supervisor sign-off.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Administrator Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setAdminMenuOpen(!adminMenuOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2.5 pl-1.5 pr-2.5 py-1 bg-[#191733] border border-[#342d63] rounded-xl hover:border-[#52479e] transition-colors shadow-sm"
          >
            <PixelAvatar size={28} />
            <span className="text-[13px] font-semibold text-white">Admin</span>
            <ChevronDown
              size={14}
              className={`text-[#8d87bc] transition-transform duration-200 ${
                adminMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Admin Dropdown Menu */}
          {adminMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 p-1.5 bg-[#181634] border border-[#3e3678] rounded-2xl shadow-2xl z-50">
              <div className="px-3 py-2 border-b border-[#282352]">
                <p className="text-xs font-semibold text-white">Administrator</p>
                <p className="text-[11px] text-[#8d87bc] truncate">Admin@agentshield.sec</p>
              </div>
              <div className="py-1">
                <button
                  onClick={() => setAdminMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[#c0bbe6] hover:bg-[#25204c] hover:text-white rounded-lg transition-colors"
                >
                  <Shield size={14} /> Security Settings
                </button>
                <button
                  onClick={() => setAdminMenuOpen(false)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs font-medium text-[#c0bbe6] hover:bg-[#25204c] hover:text-white rounded-lg transition-colors"
                >
                  <CheckCircle size={14} /> System Health (OK)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
