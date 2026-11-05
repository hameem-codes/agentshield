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

  const renderToolIcon = (tool: string) => {
    switch (tool) {
      case 'read_web':
        return <PixelGlobeIcon size={14} className="text-[#60a5fa]" />;
      case 'export_db':
        return <PixelDatabaseIcon size={14} className="text-[#a78bfa]" />;
      case 'send_email':
        return <PixelMailIcon size={14} className="text-[#38bdf8]" />;
      case 'api_call':
        return <PixelCodeIcon size={14} className="text-[#34d399]" />;
      case 'update_record':
        return <PixelPencilIcon size={14} className="text-[#fbbf24]" />;
      case 'download_file':
        return <PixelDownloadIcon size={14} className="text-[#c084fc]" />;
      default:
        return <PixelGlobeIcon size={14} className="text-[#938ebf]" />;
    }
  };

  const isPending = request.status === 'Pending';

  return (
    <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners shadow-[0_4px_24px_rgba(0,0,0,0.45)] h-full flex flex-col">
      <div className="w-full h-full bg-[#16142e] pixel-corners p-4 flex flex-col justify-between overflow-y-auto">
        <div>
          {/* 1. TOP HEADER: ID + STATUS BADGE + CLOSE BUTTON */}
          <div className="flex items-center justify-between pb-2 border-b border-[#292352]">
            {/* Request ID Pill */}
            <span className="px-2.5 py-1 rounded-md bg-[#251d52] border border-[#4d3d96] text-[#c4bbf0] font-mono text-xs font-bold">
              {request.id}
            </span>

            {/* Status Badge + Close Button */}
            <div className="flex items-center gap-2">
              {request.status === 'Pending' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#332b14] border border-[#71540f] text-[#facc15] font-semibold text-xs">
                  <span>🕒</span>
                  <span>Pending Review</span>
                </span>
              ) : request.status === 'Approved' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#14331b] border border-[#1f6633] text-[#4ade80] font-semibold text-xs">
                  <span>✔</span>
                  <span>Approved</span>
                </span>
              ) : request.status === 'Denied' ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#381616] border border-[#782424] text-[#f87171] font-semibold text-xs">
                  <span>✖</span>
                  <span>Denied</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#252042] border border-[#483d7a] text-[#a59ecd] font-semibold text-xs">
                  <span>Expired</span>
                </span>
              )}

              <button
                onClick={onClose}
                className="flex items-center justify-center w-6 h-6 rounded-md text-[#8b84bc] hover:text-white hover:bg-[#25204c] transition-colors"
                title="Close panel"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* 2. REQUEST TITLE & SUBTITLE */}
          <div className="mt-3">
            <h3 className="text-[17px] font-bold text-white tracking-tight leading-snug">
              {request.title}
            </h3>
            <p className="text-xs text-[#958fbe] font-medium mt-0.5">
              {request.proposedByText}
            </p>
          </div>

          {/* 3. TWO SIDE-BY-SIDE CARDS: RISK SCORE & AGENT/TOOL */}
          <div className="grid grid-cols-2 gap-2.5 mt-3.5">
            {/* Left Card: Risk Score */}
            <div className="bg-[#1b183a] border border-[#372f6a] rounded-xl p-3 flex flex-col items-center justify-center">
              <span className="text-[11px] font-medium text-[#8e87bf]">Risk Score</span>
              <span
                className={`text-[28px] font-bold font-mono leading-none my-1 ${
                  request.riskScore >= 75
                    ? 'text-[#ef4444]'
                    : request.riskScore >= 40
                    ? 'text-[#f59e0b]'
                    : 'text-[#22c55e]'
                }`}
              >
                <AnimatedNumber value={request.riskScore} />
              </span>
              <span
                className={`px-2.5 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${
                  request.riskScore >= 75
                    ? 'bg-[#ef4444]'
                    : request.riskScore >= 40
                    ? 'bg-[#f59e0b]'
                    : 'bg-[#22c55e]'
                }`}
              >
                {request.riskLevel}
              </span>
            </div>

            {/* Right Card: Agent & Tool */}
            <div className="bg-[#1b183a] border border-[#372f6a] rounded-xl p-3 flex flex-col justify-center gap-2">
              <div className="flex items-center gap-2">
                <span className="flex-shrink-0 text-[#a5b4fc]">
                  <PixelRobotIcon size={16} />
                </span>
                <div className="overflow-hidden">
                  <div className="text-[10px] font-medium text-[#8e87bf] leading-none">Agent</div>
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
                  <div className="text-[10px] font-medium text-[#8e87bf] leading-none">Tool</div>
                  <div className="text-xs font-mono font-bold text-white truncate mt-0.5">
                    {request.tool}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. REQUESTED ACTION (CODE PANEL) */}
          <div className="mt-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-white tracking-wide">
                Requested Action
              </span>
              <button
                onClick={handleCopyJson}
                className="flex items-center gap-1 text-[11px] font-medium text-[#a59ecd] hover:text-white transition-colors"
                title="Copy action payload"
              >
                {copiedJson ? (
                  <>
                    <Check size={12} className="text-[#22c55e]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                  </>
                )}
              </button>
            </div>
            <pre className="p-3 bg-[#100e23] border border-[#2b2459] rounded-xl text-[11.5px] font-mono text-[#f87171] overflow-x-auto leading-relaxed shadow-inner">
              <span className="text-white">{'{'}&nbsp;</span>
              {Object.entries(request.actionPayload).map(([key, val], idx, arr) => (
                <div key={key} className="pl-3">
                  <span className="text-[#93c5fd]">"{key}"</span>
                  <span className="text-white">: </span>
                  <span className={typeof val === 'number' ? 'text-[#facc15]' : 'text-[#f87171]'}>
                    {typeof val === 'string' ? `"${val}"` : String(val)}
                  </span>
                  {idx < arr.length - 1 && <span className="text-white">,</span>}
                </div>
              ))}
              <span className="text-white">{'}'}</span>
            </pre>
          </div>

          {/* 5. SECURITY EVALUATION */}
          <div className="mt-3.5">
            <span className="text-xs font-bold text-white tracking-wide block mb-2">
              Security Evaluation
            </span>

            <div className="space-y-2 text-xs">
              {/* Policy Check */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#181635] border border-[#2e2759]">
                <div className="flex items-center gap-2">
                  <Shield size={14} className="text-[#a59ecd]" />
                  <span className="text-[#cdc7ea] font-medium">Policy Check</span>
                </div>
                <div className="flex items-center gap-1 text-[#ef4444] font-medium">
                  <XCircle size={13} strokeWidth={2.5} />
                  <span className="text-[11.5px]">{request.policyCheck.text}</span>
                </div>
              </div>

              {/* Risk Factors */}
              <div className="flex items-start justify-between p-2 rounded-lg bg-[#181635] border border-[#2e2759]">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <AlertTriangle size={14} className="text-[#a59ecd]" />
                  <span className="text-[#cdc7ea] font-medium">Risk Factors</span>
                </div>
                <span className="text-[11.5px] text-[#cdc7ea] text-right ml-2 font-medium">
                  {request.riskFactors}
                </span>
              </div>

              {/* Injection Check */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[#181635] border border-[#2e2759]">
                <div className="flex items-center gap-2">
                  <Code2 size={14} className="text-[#a59ecd]" />
                  <span className="text-[#cdc7ea] font-medium">Injection Check</span>
                </div>
                <div className="flex items-center gap-1 text-[#22c55e] font-medium">
                  <CheckCircle2 size={13} strokeWidth={2.5} />
                  <span className="text-[11.5px]">{request.injectionCheck.text}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 6. POLICY CONTEXT */}
          <div className="mt-3.5">
            <span className="text-xs font-bold text-white tracking-wide block mb-1.5">
              Policy Context
            </span>
            <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-[#181635] border border-[#2e2759]">
              <FileText size={16} className="text-[#a59ecd] mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-semibold text-white">
                  {request.policyContext.name}
                </div>
                <div className="text-[11px] font-mono text-[#8e87bf] mt-0.5">
                  {request.policyContext.version} · {request.policyContext.hash}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 7. ACTION BUTTONS: APPROVE & DENY */}
        {isPending ? (
          <div className="flex items-center gap-3 pt-4 mt-3 border-t border-[#292352]">
            {/* Approve Button */}
            <button
              type="button"
              data-action="approve"
              onClick={() => onApprove(request)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white font-bold text-xs tracking-wide shadow-[0_4px_14px_rgba(34,197,94,0.35)] active:scale-95 transition-all cursor-pointer"
            >
              <Check size={15} strokeWidth={3} />
              <span>Approve</span>
            </button>

            {/* Deny Button */}
            <button
              type="button"
              data-action="deny"
              onClick={() => onDeny(request)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold text-xs tracking-wide shadow-[0_4px_14px_rgba(239,68,68,0.35)] active:scale-95 transition-all cursor-pointer"
            >
              <X size={15} strokeWidth={3} />
              <span>Deny</span>
            </button>
          </div>
        ) : (
          <div className="pt-3 mt-3 border-t border-[#292352] text-center text-xs text-[#8e87bf]">
            This request has already been resolved ({request.status}).
          </div>
        )}
      </div>
    </div>
  );
};
