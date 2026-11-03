import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  Shield,
  AlertTriangle,
  Code2,
  FileText,
  CheckCircle2,
  XCircle,
  GitCommit,
  ShieldAlert,
  Terminal,
} from 'lucide-react';
import type { ReviewRequest } from './reviewTypes';
import { PixelRobotIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';
import {
  PixelGlobeIcon,
  PixelDatabaseIcon,
  PixelMailIcon,
  PixelCodeIcon,
  PixelPencilIcon,
  PixelDownloadIcon,
} from './ReviewIcons';

interface ReviewDetailsPanelProps {
  request: ReviewRequest | null;
  onClose: () => void;
  onApprove: (req: ReviewRequest) => void;
  onDeny: (req: ReviewRequest) => void;
}

export const ReviewDetailsPanel: React.FC<ReviewDetailsPanelProps> = ({
  request,
  onClose,
  onApprove,
  onDeny,
}) => {
  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);

  if (!request) {
    return (
      <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners h-full">
        <div className="w-full h-full bg-[#16142e] pixel-corners p-6 flex flex-col items-center justify-center text-center text-[#8e87bf]">
          <p className="text-sm">Select a review request from the table to inspect details.</p>
        </div>
      </div>
    );
  }

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(request.actionPayload, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const cleanHash = request.policyContext.hash.replace(/^Hash:\s*/i, '').trim();
  const cleanVersion = request.policyContext.version.replace(/^Version:\s*/i, '').trim();
  const cleanPolicyName = request.policyContext.name.replace(/^Policy:\s*/i, '').trim();

  const handleCopyHash = () => {
    navigator.clipboard.writeText(cleanHash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Helper for JSON syntax coloring
  const formatJsonHighlighted = (obj: unknown) => {
    const raw = JSON.stringify(obj, null, 2);
    return raw.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'text-[#86efac]'; // string
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'text-[#93c5fd] font-semibold'; // key
          }
        } else if (/true|false/.test(match)) {
          cls = 'text-[#f472b6] font-bold'; // boolean
        } else if (/null/.test(match)) {
          cls = 'text-[#9ca3af] italic'; // null
        } else {
          cls = 'text-[#fde047] font-bold'; // number
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
  };

  const renderToolIcon = (tool: string) => {
    switch (tool) {
      case 'read_web':
      case 'Read_Web':
        return <PixelGlobeIcon size={14} className="text-[#60a5fa]" />;
      case 'export_db':
      case 'Export_Db':
        return <PixelDatabaseIcon size={14} className="text-[#a78bfa]" />;
      case 'send_email':
      case 'Send_Email':
        return <PixelMailIcon size={14} className="text-[#38bdf8]" />;
      case 'api_call':
      case 'Api_Call':
        return <PixelCodeIcon size={14} className="text-[#34d399]" />;
      case 'update_record':
      case 'Update_Record':
        return <PixelPencilIcon size={14} className="text-[#fbbf24]" />;
      case 'download_file':
      case 'Download_File':
        return <PixelDownloadIcon size={14} className="text-[#c084fc]" />;
      default:
        return <PixelGlobeIcon size={14} className="text-[#938ebf]" />;
    }
  };

  const isPending = request.status === 'Pending';

  // Split comma-separated risk factors into individual capitalized chips
  const riskFactorChips = request.riskFactors
    ? request.riskFactors
        .split(',')
        .map((f) => f.trim())
        .filter(Boolean)
        .map((chip) => chip.charAt(0).toUpperCase() + chip.slice(1))
    : [];

  const isCriticalRisk = request.riskScore >= 75;
  const isMediumRisk = request.riskScore >= 40 && request.riskScore < 75;

  return (
    <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners shadow-[0_4px_24px_rgba(0,0,0,0.45)] h-full flex flex-col">
      <div className="w-full h-full bg-[#16142e] pixel-corners p-3.5 flex flex-col justify-between overflow-y-auto">
        <div>
          {/* 1. TOP HEADER: ID + STATUS BADGE + CLOSE BUTTON */}
          <div className="flex items-center justify-between pb-2 border-b border-[#292352]">
            {/* Request ID Pill */}
            <span className="px-2.5 py-0.5 rounded-md bg-[#251d52] border border-[#4d3d96] text-[#c4bbf0] font-mono text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-[#818cf8]" />
              {request.id}
            </span>

            {/* Status Badge + Close Button */}
            <div className="flex items-center gap-2">
              {request.status === 'Pending' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#332b14] border border-[#71540f] text-[#facc15] font-semibold text-xs shadow-[0_0_10px_rgba(250,204,21,0.15)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#facc15] animate-pulse" />
                  <span>Pending Review</span>
                </span>
              ) : request.status === 'Approved' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#14331b] border border-[#1f6633] text-[#4ade80] font-semibold text-xs shadow-[0_0_10px_rgba(74,222,128,0.15)]">
                  <CheckCircle2 size={12} className="text-[#4ade80]" />
                  <span>Approved</span>
                </span>
              ) : request.status === 'Denied' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#381616] border border-[#782424] text-[#f87171] font-semibold text-xs shadow-[0_0_10px_rgba(248,113,113,0.15)]">
                  <XCircle size={12} className="text-[#f87171]" />
                  <span>Denied</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#252042] border border-[#483d7a] text-[#a59ecd] font-semibold text-xs">
                  <span>Expired</span>
                </span>
              )}

              <button
                onClick={onClose}
                className="flex items-center justify-center w-6 h-6 rounded-md text-[#8b84bc] hover:text-white hover:bg-[#25204c] transition-colors cursor-pointer"
                title="Close panel"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 2. REQUEST TITLE & SUBTITLE */}
          <div className="mt-2.5">
            <h3 className="text-[16px] font-bold text-white tracking-tight leading-snug">
              {request.title}
            </h3>
            <p className="text-[11px] text-[#958fbe] font-medium mt-0.5">
              {request.proposedByText}
            </p>
          </div>

          {/* 3. TWO SIDE-BY-SIDE CARDS: RISK SCORE & AGENT/TOOL */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {/* Left Card: Risk Score */}
            <div
              className={`rounded-xl p-2.5 flex flex-col items-center justify-center relative overflow-hidden border ${
                isCriticalRisk
                  ? 'border-[#ef4444]/40 bg-gradient-to-b from-[#2b1424] to-[#171434] shadow-[0_0_14px_rgba(239,68,68,0.15)]'
                  : isMediumRisk
                  ? 'border-[#f59e0b]/40 bg-gradient-to-b from-[#2c2214] to-[#171434] shadow-[0_0_14px_rgba(245,158,11,0.15)]'
                  : 'border-[#22c55e]/40 bg-gradient-to-b from-[#142d1d] to-[#171434] shadow-[0_0_14px_rgba(34,197,94,0.15)]'
              }`}
            >
              <span className="text-[10.5px] font-medium text-[#9d97cb]">Risk Score</span>
              <span
                className={`text-[26px] font-bold font-mono leading-none my-0.5 ${
                  isCriticalRisk
                    ? 'text-[#ef4444]'
                    : isMediumRisk
                    ? 'text-[#f59e0b]'
                    : 'text-[#22c55e]'
                }`}
              >
                <AnimatedNumber value={request.riskScore} />
              </span>
              <span
                className={`px-2 py-0.2 rounded-full text-[9.5px] font-bold uppercase tracking-wider text-white shadow-xs ${
                  isCriticalRisk
                    ? 'bg-[#ef4444]'
                    : isMediumRisk
                    ? 'bg-[#f59e0b]'
                    : 'bg-[#22c55e]'
                }`}
              >
                {request.riskLevel}
              </span>
            </div>

            {/* Right Card: Agent & Tool */}
            <div className="bg-[#191637] border border-[#342c67] rounded-xl p-2.5 flex flex-col justify-center gap-2">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 text-[#a5b4fc]">
                  <PixelRobotIcon size={15} />
                </span>
                <div className="overflow-hidden">
                  <div className="text-[9.5px] font-medium text-[#8e87bf] leading-none">Agent</div>
                  <div className="text-xs font-bold text-white truncate mt-0.5">
                    {request.agent}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="flex-shrink-0">
                  {renderToolIcon(request.tool)}
                </span>
                <div className="overflow-hidden">
                  <div className="text-[9.5px] font-medium text-[#8e87bf] leading-none">Tool</div>
                  <div className="text-xs font-mono font-bold text-white truncate mt-0.5">
                    {request.tool}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. REQUESTED ACTION (TERMINAL INSPECTOR WINDOW) */}
          <div className="mt-3">
            <div className="bg-[#0e0c1f] border border-[#2b2554] rounded-xl overflow-hidden shadow-lg">
              {/* Terminal Title Bar */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-[#181534] border-b border-[#28204e]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/90 inline-block shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]/90 inline-block shadow-[0_0_6px_rgba(234,179,8,0.4)]" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/90 inline-block shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                  </div>
                  <span className="text-[11px] font-mono text-[#a5b4fc] font-semibold flex items-center gap-1.5 ml-1">
                    <Terminal size={12} className="text-[#818cf8]" />
                    <span>Action_Payload.json</span>
                  </span>
                </div>

                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 text-[11px] font-mono text-[#a59ecd] hover:text-white px-2 py-0.5 rounded-md hover:bg-[#251f47] transition-all cursor-pointer"
                  title="Copy action payload"
                >
                  {copiedJson ? (
                    <>
                      <Check size={12} className="text-[#22c55e]" />
                      <span className="text-[#22c55e]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={12} />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
              </div>

              {/* Syntax-Highlighted Code View */}
              <pre
                className="p-3 text-[11.5px] font-mono text-[#dcd7f2] overflow-x-auto max-h-48 leading-relaxed select-text bg-[#0e0c1f]"
                dangerouslySetInnerHTML={{
                  __html: formatJsonHighlighted(request.actionPayload),
                }}
              />
            </div>
          </div>

          {/* 5. SECURITY EVALUATION (UNIFIED HIGH-TECH STATUS CARD) */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white tracking-wide flex items-center gap-1.5">
                <ShieldAlert size={13} className="text-[#a78bfa]" />
                <span>Security Evaluation</span>
              </span>
              <span className="text-[9.5px] font-mono font-semibold px-2 py-0.2 rounded bg-[#251d52] border border-[#483a8f] text-[#c4bbf0]">
                3 CHECKS
              </span>
            </div>

            <div className="bg-[#121026] border border-[#2e265c] rounded-xl overflow-hidden divide-y divide-[#221c47] shadow-sm">
              {/* Policy Check */}
              <div className="p-2.5 flex items-center justify-between gap-3 hover:bg-[#181534]/40 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#221c47] border border-[#3b3075] flex items-center justify-center text-[#a78bfa] flex-shrink-0">
                    <Shield size={13} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Policy Check</div>
                    <div className="text-[10px] text-[#8e87bf]">Automated Rule Evaluation</div>
                  </div>
                </div>

                <div>
                  {request.policyCheck.status === 'requires_approval' ||
                  request.policyCheck.text.toLowerCase().includes('approval') ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3d1822] border border-[#ef4444]/40 text-[#f87171] text-[10.5px] font-semibold font-mono shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444] animate-pulse" />
                      <AlertTriangle size={11} className="text-[#ef4444]" />
                      <span>{request.policyCheck.text}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#133822] border border-[#22c55e]/40 text-[#4ade80] text-[10.5px] font-semibold font-mono shadow-[0_0_8px_rgba(34,197,94,0.15)]">
                      <CheckCircle2 size={11} className="text-[#22c55e]" />
                      <span>{request.policyCheck.text}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Risk Factors */}
              <div className="p-2.5 flex items-start justify-between gap-3 hover:bg-[#181534]/40 transition-colors">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-6 h-6 rounded-md bg-[#2a1d2e] border border-[#592c4a] flex items-center justify-center text-[#f472b6] flex-shrink-0">
                    <AlertTriangle size={13} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Risk Factors</div>
                    <div className="text-[10px] text-[#8e87bf]">Detected Signals</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-1.5 max-w-[65%]">
                  {riskFactorChips.length > 0 ? (
                    riskFactorChips.map((chip, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#251930] border border-[#6b254e] text-[#f472b6] text-[10.5px] font-mono font-medium shadow-xs"
                      >
                        <span className="w-1 h-1 rounded-full bg-[#f472b6]" />
                        <span>{chip}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[10.5px] text-[#8e87bf] italic">None</span>
                  )}
                </div>
              </div>

              {/* Injection Check */}
              <div className="p-2.5 flex items-center justify-between gap-3 hover:bg-[#181534]/40 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-md bg-[#142838] border border-[#1f4a66] flex items-center justify-center text-[#38bdf8] flex-shrink-0">
                    <Code2 size={13} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Injection Analysis</div>
                    <div className="text-[10px] text-[#8e87bf]">Prompt Injection & Vectors</div>
                  </div>
                </div>

                <div>
                  {request.injectionCheck.passed ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#133822] border border-[#22c55e]/40 text-[#4ade80] text-[10.5px] font-semibold font-mono shadow-[0_0_8px_rgba(34,197,94,0.15)]">
                      <CheckCircle2 size={11} className="text-[#22c55e]" />
                      <span>{request.injectionCheck.text}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#3d1822] border border-[#ef4444]/40 text-[#f87171] text-[10.5px] font-semibold font-mono shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                      <XCircle size={11} className="text-[#ef4444]" />
                      <span>{request.injectionCheck.text}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 6. POLICY CONTEXT (HIGH-TECH POLICY CARD) */}
          <div className="mt-3">
            <span className="text-xs font-bold text-white tracking-wide block mb-1.5 flex items-center gap-1.5">
              <FileText size={13} className="text-[#c084fc]" />
              <span>Policy Context</span>
            </span>

            <div className="bg-[#121026] border border-[#2e265c] rounded-xl p-2.5 flex items-center justify-between shadow-sm hover:border-[#41357c] transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#271d4e] border border-[#4a3794] flex items-center justify-center text-[#c4bbf0] shadow-xs flex-shrink-0">
                  <FileText size={15} className="text-[#a78bfa]" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white tracking-wide">
                      {cleanPolicyName}
                    </span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#291f52] text-[#a78bfa] border border-[#4d3a9c]">
                      ACTIVE
                    </span>
                  </div>
                  <div className="text-[10px] text-[#8e87bf] mt-0.5">
                    Enforced Security Boundary
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="px-2 py-0.5 rounded-md bg-[#1c183b] border border-[#3b3070] text-[#93c5fd] font-mono text-[10.5px] font-semibold">
                  {cleanVersion}
                </span>

                <button
                  type="button"
                  onClick={handleCopyHash}
                  className="px-2 py-0.5 rounded-md bg-[#1c183b] border border-[#3b3070] hover:border-[#6351b5] text-[#a59ecd] hover:text-white font-mono text-[10.5px] flex items-center gap-1 transition-all cursor-pointer"
                  title="Copy policy commit hash"
                >
                  <GitCommit size={11} className="text-[#a78bfa]" />
                  <span>{cleanHash}</span>
                  {copiedHash ? (
                    <Check size={11} className="text-[#22c55e] ml-0.5" />
                  ) : (
                    <Copy size={11} className="text-[#7d77a8] ml-0.5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 7. ACTION BUTTONS: APPROVE & DENY */}
        {isPending ? (
          <div className="flex items-center gap-2.5 pt-3 mt-2.5 border-t border-[#292352]">
            {/* Approve Button */}
            <button
              type="button"
              data-action="approve"
              onClick={() => onApprove(request)}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs tracking-wide shadow-[0_4px_14px_rgba(34,197,94,0.35)] active:scale-95 transition-all cursor-pointer"
            >
              <Check size={14} strokeWidth={3} />
              <span>Approve</span>
            </button>

            {/* Deny Button */}
            <button
              type="button"
              data-action="deny"
              onClick={() => onDeny(request)}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-xs tracking-wide shadow-[0_4px_14px_rgba(239,68,68,0.35)] active:scale-95 transition-all cursor-pointer"
            >
              <X size={14} strokeWidth={3} />
              <span>Deny</span>
            </button>
          </div>
        ) : (
          <div className="pt-2.5 mt-2.5 border-t border-[#292352] text-center text-xs text-[#8e87bf]">
            This Request Has Already Been Resolved ({request.status}).
          </div>
        )}
      </div>
    </div>
  );
};
