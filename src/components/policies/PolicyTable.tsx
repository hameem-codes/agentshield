import React, { useState } from 'react';
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
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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
                <th className="py-3 px-3 w-10 text-center"></th>
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

                      {/* Row Action Menu */}
                      <td
                        className="py-2.5 px-3 text-center relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            setActiveMenuId(activeMenuId === pol.id ? null : pol.id)
                          }
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-[#8b84bc] hover:text-white hover:bg-[#25204c] transition-colors mx-auto"
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {activeMenuId === pol.id && (
                          <div className="absolute right-3 top-9 w-40 p-1 bg-[#191637] border border-[#3e3678] rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                            <button
                              onClick={() => {
                                onSelectPolicy(pol);
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Eye size={13} />
                              <span>View Details</span>
                            </button>
                            <button
                              onClick={() => {
                                onEditPolicy(pol);
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Edit3 size={13} />
                              <span>Edit Policy</span>
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(pol.rules, null, 2));
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Copy size={13} />
                              <span>Copy Rules</span>
                            </button>
                            <button
                              onClick={() => {
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Archive size={13} />
                              <span>Archive</span>
                            </button>
                          </div>
                        )}
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
            <span className="text-white font-mono"><AnimatedNumber value={policies.length} /></span> policies
          </div>
        </div>
      </div>
    </div>
  );
};

