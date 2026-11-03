import React, { useState } from 'react';
import {
  MoreHorizontal,
  Edit3,
  Globe,
  Sliders,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import type { SecurityPolicy } from './policyTypes';
import { PixelLayersIcon, PixelRobotIcon } from '../pixel/PixelIcons';
import { PixelGlobeIcon, PixelDownloadIcon } from '../review/ReviewIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';

interface PolicyDetailPanelProps {
  policy: SecurityPolicy | null;
  onClose?: () => void;
  onEditPolicy: (policy: SecurityPolicy) => void;
}

export const PolicyDetailPanel: React.FC<PolicyDetailPanelProps> = ({
  policy,
  onClose,
  onEditPolicy,
}) => {
  const [activeTab, setActiveTab] = useState<'Rules' | 'Agents' | 'History'>('Rules');

  if (!policy) {
    return (
      <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners h-full">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-6 flex flex-col items-center justify-center text-center text-[#8e87bf]">
          <p className="text-sm">Select a security policy from the table to inspect details.</p>
        </div>
      </div>
    );
  }

  const renderToolBadge = (tool: string) => {
    return (
      <span
        key={tool}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#1e1a44] border border-[#3f357b] text-white font-mono text-xs font-semibold shadow-xs"
      >
        {tool.includes('download') ? (
          <PixelDownloadIcon size={13} className="text-[#c084fc]" />
        ) : (
          <PixelGlobeIcon size={13} className="text-[#60a5fa]" />
        )}
        <span>{tool}</span>
      </span>
    );
  };

  return (
    <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners shadow-[0_4px_24px_rgba(0,0,0,0.45)] h-full flex flex-col">
      <div className="w-full h-full max-h-[calc(100vh-96px)] bg-[#16142e] pixel-corners p-4 flex flex-col justify-between overflow-y-auto">
        <div>
          {/* 1. PANEL HEADER */}
          <div className="pb-3 border-b border-[#292352]">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#271f54] border border-[#4d3d96] text-[#c4bbf0] flex-shrink-0">
                  <PixelLayersIcon size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white tracking-tight">
                      {policy.name}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2 py-0.2 rounded-md text-[11px] font-bold ${
                        policy.status === 'Active'
                          ? 'bg-[#15803d]/30 border border-[#22c55e] text-[#4ade80]'
                          : policy.status === 'Draft'
                          ? 'bg-[#a16207]/30 border border-[#eab308] text-[#fde047]'
                          : 'bg-[#221e42] border border-[#3b3470] text-[#a59ecd]'
                      }`}
                    >
                      {policy.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#9c96c9] mt-0.5 font-medium">
                    {policy.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button className="flex items-center justify-center w-7 h-7 rounded-lg text-[#8b84bc] hover:text-white hover:bg-[#25204c] transition-colors">
                  <MoreHorizontal size={15} />
                </button>

                {onClose && (
                  <button
                    onClick={onClose}
                    className="flex items-center justify-center w-7 h-7 rounded-lg text-[#8b84bc] hover:text-white hover:bg-[#25204c] transition-colors"
                    title="Close panel"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 2. METADATA CARDS (Version, Agents, Updated) */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="bg-[#1b183a] border border-[#372f6a] rounded-xl p-2.5 text-center">
              <div className="text-[10.5px] font-medium text-[#8e87bf]">Version</div>
              <div className="font-mono text-xs font-bold text-white mt-0.5">
                {policy.version}
              </div>
            </div>

            <div className="bg-[#1b183a] border border-[#372f6a] rounded-xl p-2.5 text-center">
              <div className="text-[10.5px] font-medium text-[#8e87bf]">Agents</div>
              <div className="font-mono text-xs font-bold text-white mt-0.5">
                <AnimatedNumber value={policy.assignedAgentNames.length} />
              </div>
            </div>

            <div className="bg-[#1b183a] border border-[#372f6a] rounded-xl p-2.5 text-center">
              <div className="text-[10.5px] font-medium text-[#8e87bf]">Updated</div>
              <div className="text-xs font-medium text-white mt-0.5 truncate">
                {policy.lastUpdated.split(',')[0]}
              </div>
            </div>
          </div>

          {/* 3. DETAIL TABS (Rules, Agents, Version History) */}
          <div className="flex items-center gap-1.5 p-1 bg-[#181635] border border-[#30285a] rounded-xl mt-3.5 select-none">
            <button
              onClick={() => setActiveTab('Rules')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors ${
                activeTab === 'Rules'
                  ? 'bg-[#6d3ee8] text-white shadow-sm'
                  : 'text-[#9c96c9] hover:text-white hover:bg-[#221c47]'
              }`}
            >
              Rules
            </button>

            <button
              onClick={() => setActiveTab('Agents')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors ${
                activeTab === 'Agents'
                  ? 'bg-[#6d3ee8] text-white shadow-sm'
                  : 'text-[#9c96c9] hover:text-white hover:bg-[#221c47]'
              }`}
            >
              Agents (<AnimatedNumber value={policy.assignedAgentNames.length} />)
            </button>

            <button
              onClick={() => setActiveTab('History')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg text-center transition-colors ${
                activeTab === 'History'
                  ? 'bg-[#6d3ee8] text-white shadow-sm'
                  : 'text-[#9c96c9] hover:text-white hover:bg-[#221c47]'
              }`}
            >
              Version History
            </button>
          </div>

          {/* 4. TAB CONTENTS */}
          <div className="mt-3.5 space-y-3.5">
            {activeTab === 'Rules' && (
              <>
                {/* Allowed Tools */}
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2">
                    <Sliders size={13} className="text-[#a59ecd]" />
                    <span>Allowed Tools</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {policy.rules.allowedTools.length > 0 ? (
                      policy.rules.allowedTools.map(renderToolBadge)
                    ) : (
                      <span className="text-xs text-[#8e87bf]">No tools allowed.</span>
                    )}
                  </div>
                </div>

                {/* Argument Limits */}
                <div className="bg-[#181635] border border-[#2e2759] rounded-xl p-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] mb-2">
                    Argument Limits
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[#8e87bf] block">Max items/request</span>
                      <span className="font-mono font-bold text-white mt-0.5 block">
                        {policy.rules.argumentLimits.maxItemsPerRequest}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#8e87bf] block">Max file size</span>
                      <span className="font-mono font-bold text-white mt-0.5 block">
                        {policy.rules.argumentLimits.maxFileSize}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Destination Control */}
                <div className="bg-[#181635] border border-[#2e2759] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-white mb-2">
                    <Globe size={13} className="text-[#60a5fa]" />
                    <span>Allowed Hostnames ({policy.rules.allowedHostnames.length})</span>
                  </div>
                  <div className="space-y-1.5 font-mono text-[11.5px]">
                    {policy.rules.allowedHostnames.length > 0 ? (
                      policy.rules.allowedHostnames.map((host) => (
                        <div
                          key={host}
                          className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#121026] text-[#93c5fd]"
                        >
                          <span className="text-[#3b82f6]">•</span>
                          <span>{host}</span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[#8e87bf]">None specified (local only)</div>
                    )}
                  </div>
                </div>

                {/* Audit & Behavior */}
                <div className="bg-[#181635] border border-[#2e2759] rounded-xl p-3 space-y-2 text-xs">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] mb-1">
                    Audit & Behavior
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#cdc7ea]">Default Deny</span>
                    <span className="text-white font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-[#22c55e]" />
                      <span>All other tools blocked</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#cdc7ea]">Review Threshold</span>
                    <span className="text-white font-semibold flex items-center gap-1">
                      <AlertCircle size={13} className="text-[#eab308]" />
                      <span>Requires review for ≥ {policy.rules.reviewThreshold}</span>
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[#cdc7ea]">Telemetry Audit</span>
                    <span className="text-white font-semibold flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-[#22c55e]" />
                      <span>All actions audited</span>
                    </span>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'Agents' && (
              <div className="space-y-2.5">
                {policy.agents.length === 0 ? (
                  <div className="text-center py-6 text-xs text-[#8e87bf]">
                    No agents currently assigned to this policy.
                  </div>
                ) : (
                  policy.agents.map((ag) => (
                    <div
                      key={ag.id}
                      className="p-3 bg-[#181635] border border-[#2e2759] rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="text-[#a5b4fc]">
                          <PixelRobotIcon size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white">
                            {ag.name}
                          </div>
                          <div className="text-[11px] text-[#8e87bf] mt-0.5">
                            {ag.runtime} · Assigned {ag.assignedDate}
                          </div>
                        </div>
                      </div>

                      <span className="px-2 py-0.5 rounded-md bg-[#15803d]/30 border border-[#22c55e] text-[#4ade80] text-[11px] font-semibold">
                        {ag.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'History' && (
              <div className="space-y-2.5">
                {policy.versions.map((ver) => (
                  <div
                    key={ver.version}
                    className="p-3 bg-[#181635] border border-[#2e2759] rounded-xl"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          {ver.version}
                        </span>
                        {ver.isCurrent && (
                          <span className="px-1.5 py-0.2 rounded-md bg-[#6d3ee8] text-white text-[10px] font-bold uppercase">
                            Current
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#8e87bf]">
                        {ver.date}
                      </span>
                    </div>
                    <p className="text-xs text-[#cdc7ea] mt-1.5 leading-relaxed">
                      {ver.description}
                    </p>
                    <div className="text-[11px] text-[#8e87bf] mt-1 flex items-center gap-1">
                      <span>Author: {ver.author}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 5. BOTTOM EDIT POLICY BUTTON */}
        <div className="pt-3 mt-4 border-t border-[#292352]">
          <button
            onClick={() => onEditPolicy(policy)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#231f47] border border-[#52449c] hover:bg-[#6d3ee8] text-white font-bold text-xs tracking-wide shadow-md transition-all active:scale-98 cursor-pointer"
          >
            <Edit3 size={14} />
            <span>Edit Policy</span>
          </button>
        </div>
      </div>
    </div>
  );
};
