import React, { useState, useEffect } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { PixelRobotIcon, PixelCrossShieldIcon, PixelSlidersIcon } from './pixel/PixelIcons';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAction?: (action: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectAction,
}) => {
  const [query, setQuery] = useState('');

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const commands = [
    { id: '1', title: 'research-agent', subtitle: 'Agent • Active • Research v2', category: 'Agents', icon: PixelRobotIcon },
    { id: '2', title: 'email-agent', subtitle: 'Agent • Paused • Restricted v1', category: 'Agents', icon: PixelRobotIcon },
    { id: '3', title: 'ops-agent', subtitle: 'Agent • Active • Operations v1', category: 'Agents', icon: PixelRobotIcon },
    { id: '4', title: 'email-agent · send_email (Risk 87)', subtitle: 'Blocked Event • Unauthorized egress', category: 'Events', icon: PixelCrossShieldIcon },
    { id: '5', title: 'ops-agent · list_files (Risk 68)', subtitle: 'Review Event • Sensitive secrets inspection', category: 'Events', icon: PixelCrossShieldIcon },
    { id: '6', title: 'Research v2 Sandbox Rules', subtitle: 'Policy • Outbound web whitelist', category: 'Policies', icon: PixelSlidersIcon },
    { id: '7', title: 'Restricted v1 Policy Definitions', subtitle: 'Policy • Strict egress gating', category: 'Policies', icon: PixelSlidersIcon },
  ];

  const filtered = commands.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.subtitle.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl bg-[#171533] border border-[#3e3678] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#2a2456] gap-3">
          <Search size={18} className="text-[#8c85bd]" />
          <input
            type="text"
            placeholder="Type a command or search events, agents, policies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-white placeholder-[#7872a3] focus:outline-none font-medium"
          />
          <button
            onClick={onClose}
            className="p-1 text-[#8c85bd] hover:text-white rounded-md transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length > 0 ? (
            <div className="flex flex-col gap-1">
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (onSelectAction) onSelectAction(item.title);
                      onClose();
                    }}
                    className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl text-left hover:bg-[#231f47] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 flex items-center justify-center">
                        <Icon size={18} />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-[#c4bbf0] transition-colors">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-[#8680b5]">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>
                    <ArrowRight size={14} className="text-[#6d669c] group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[#8c85bd]">
              No results found for "{query}"
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#2a2456] bg-[#14122b] text-[11px] text-[#716a9c]">
          <span>Navigation: <kbd className="px-1.5 py-0.5 bg-[#201d42] rounded text-[#a59fcf]">↑</kbd> <kbd className="px-1.5 py-0.5 bg-[#201d42] rounded text-[#a59fcf]">↓</kbd> to navigate</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-[#201d42] rounded text-[#a59fcf]">ESC</kbd> to exit</span>
        </div>
      </div>
    </div>
  );
};
