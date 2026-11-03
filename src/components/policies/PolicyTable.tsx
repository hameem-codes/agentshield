import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, Eye, Edit3, Copy, Archive } from 'lucide-react';
import type { SecurityPolicy } from './policyTypes';
import { PixelLayersIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';

interface PolicyTableProps {
  policies: SecurityPolicy[];
  selectedPolicy: SecurityPolicy | null;
  onSelectPolicy: (policy: SecurityPolicy) => void;
  onEditPolicy: (policy: SecurityPolicy) => void;
}

export const PolicyTable: React.FC<PolicyTableProps> = ({
  policies,
  selectedPolicy,
  onSelectPolicy,
  onEditPolicy,
}) => {
  const [activeMenu, setActiveMenu] = useState<{
    id: string;
    policy: SecurityPolicy;
    top?: number;
    bottom?: number;
    right: number;
  } | null>(null);

  useEffect(() => {
    if (!activeMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-policy-actions-menu]')) return;
      setActiveMenu(null);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveMenu(null);
    };
    const handleScrollOrResize = () => {
      setActiveMenu(null);
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activeMenu]);

  return (
    <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
      <div className="w-full bg-[#16142e] pixel-corners flex flex-col">
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[650px]">
            {/* TABLE HEADER */}
            <thead>
              <tr className="border-b border-[#292352] text-[#dcd7f2] text-xs font-semibold select-none bg-[#16142e]">
                <th className="py-3 px-3.5 whitespace-nowrap">Policy</th>
                <th className="py-3 px-3 whitespace-nowrap">Version</th>
                <th className="py-3 px-3 whitespace-nowrap">Status</th>
                <th className="py-3 px-3 whitespace-nowrap">Agents</th>
                <th className="py-3 px-3 whitespace-nowrap">Last Updated</th>
                <th className="sticky right-0 z-20 bg-[#16142e] border-l border-[#292352] shadow-[-6px_0_12px_rgba(0,0,0,0.5)] py-3 px-2 w-10 text-center text-xs font-semibold text-[#8e87bf]">
                  <span>···</span>
                </th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-[#221e45] text-xs">
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[#8e87bf]">
                    No policies found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                policies.map((pol) => {
                  const isSelected = selectedPolicy?.id === pol.id;

                  return (
                    <tr
                      key={pol.id}
                      onClick={() => onSelectPolicy(pol)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#251e52] shadow-inner border-l-2 border-[#6d3ee8]'
                          : 'hover:bg-[#1c183b]'
                      }`}
                    >
                      {/* Policy: Icon + Name & Description */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#251f4c] border border-[#443878] text-[#c4bbf0] flex-shrink-0">
                            <PixelLayersIcon size={14} />
                          </div>
                          <div>
                            <div className="font-bold text-white text-[13px] leading-tight">
                              {pol.name}
                            </div>
                            <div className="text-[11.5px] text-[#9c96c9] mt-0.5 font-medium leading-tight">
                              {pol.description}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Version */}
                      <td className="py-2.5 px-3 font-mono text-[#aba3d6] whitespace-nowrap text-[12px]">
                        {pol.version}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        {pol.status === 'Active' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#15803d]/30 border border-[#22c55e] text-[#4ade80] font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                            <span>Active</span>
                          </span>
                        )}
                        {pol.status === 'Draft' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#a16207]/30 border border-[#eab308] text-[#fde047] font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#eab308]" />
                            <span>Draft</span>
                          </span>
                        )}
                        {pol.status === 'Archived' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-[#221e42] border border-[#3b3470] text-[#a59ecd] font-semibold text-xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#8e87bf]" />
                            <span>Archived</span>
                          </span>
                        )}
                      </td>

                      {/* Agents */}
                      <td className="py-2.5 px-3 text-white font-mono font-bold whitespace-nowrap text-[12.5px]">
                        {pol.assignedAgentNames.length}
                      </td>

                      {/* Last Updated */}
                      <td className="py-2.5 px-3 text-[#a59ecd] whitespace-nowrap text-[12px]">
                        {pol.lastUpdated}
                      </td>

                      {/* Sticky Row Action Menu */}
                      <td
                        className={`sticky right-0 z-10 ${
                          isSelected ? 'bg-[#241e4a]' : 'bg-[#16142e]'
                        } group-hover:bg-[#1f1b40] border-l border-[#221e45] shadow-[-6px_0_12px_rgba(0,0,0,0.5)] py-2.5 px-2 text-center`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeMenu?.id === pol.id) {
                              setActiveMenu(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 160;
                            const openUp = rect.bottom + menuHeight > window.innerHeight;
                            setActiveMenu({
                              id: pol.id,
                              policy: pol,
                              top: openUp ? undefined : rect.bottom + 4,
                              bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
                              right: Math.max(12, window.innerWidth - rect.right),
                            });
                          }}
                          className={`flex items-center justify-center w-7 h-7 rounded-lg text-[#8b84bc] hover:text-white transition-colors mx-auto cursor-pointer ${
                            activeMenu?.id === pol.id ? 'bg-[#40337d] text-white shadow-xs' : 'hover:bg-[#25204c]'
                          }`}
                          title="Policy options"
                          aria-label={`Actions for ${pol.name}`}
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[#292352] bg-[#16142e] text-xs text-[#9c96c9] select-none font-medium">
          <div>
            Showing <span className="text-white font-mono">1–<AnimatedNumber value={policies.length} /></span> of{' '}
            <span className="text-white font-mono"><AnimatedNumber value={policies.length} /></span> Policies
          </div>
        </div>
      </div>
      {/* Portaled Policy Actions Menu */}
      {activeMenu &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-policy-actions-menu="true"
            style={{
              position: 'fixed',
              top: activeMenu.top !== undefined ? `${activeMenu.top}px` : undefined,
              bottom: activeMenu.bottom !== undefined ? `${activeMenu.bottom}px` : undefined,
              right: `${activeMenu.right}px`,
              zIndex: 99999,
            }}
            className="w-44 p-1.5 bg-[#171434] border-2 border-[#4d408c] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.85),0_0_16px_rgba(109,62,232,0.35)] animate-in fade-in zoom-in-95 duration-100 text-left select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-2 py-1 mb-1 border-b border-[#2d255d] text-[10.5px] font-mono text-[#a59ecd] flex items-center justify-between">
              <span className="font-bold text-white truncate max-w-[100px]">{activeMenu.policy.name}</span>
              <span className="text-[9.5px] text-[#736a9c] uppercase font-mono tracking-wider">Policy</span>
            </div>
            <button
              onClick={() => {
                onSelectPolicy(activeMenu.policy);
                setActiveMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#c4bcf0] hover:bg-[#282153] hover:text-white transition-colors cursor-pointer"
            >
              <Eye size={13} className="text-[#a855f7]" />
              <span>View Details</span>
            </button>
            <button
              onClick={() => {
                onEditPolicy(activeMenu.policy);
                setActiveMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#c4bcf0] hover:bg-[#282153] hover:text-white transition-colors cursor-pointer"
            >
              <Edit3 size={13} className="text-[#38bdf8]" />
              <span>Edit Policy</span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(activeMenu.policy.rules, null, 2));
                setActiveMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#c4bcf0] hover:bg-[#282153] hover:text-white transition-colors cursor-pointer"
            >
              <Copy size={13} className="text-[#86efac]" />
              <span>Copy Rules</span>
            </button>
            <button
              onClick={() => {
                setActiveMenu(null);
              }}
              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#f87171] hover:bg-[#3d1825] hover:text-white transition-colors cursor-pointer"
            >
              <Archive size={13} />
              <span>Archive</span>
            </button>
          </div>,
          document.body
        )}
    </div>
  );
};

