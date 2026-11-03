import React from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { SecurityEventRecord } from './eventsTypes';
import { PixelRobotIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';

interface EventDrawerProps {
  event: SecurityEventRecord | null;
  onClose: () => void;
  isClosing?: boolean;
  /** 'panel' renders inline in the split view; 'drawer' renders the mobile overlay. */
  variant?: 'drawer' | 'panel';
}

export const EventDrawer: React.FC<EventDrawerProps> = ({
  event,
  onClose,
  isClosing = false,
  variant = 'drawer',
}) => {
  const [copiedId, setCopiedId] = React.useState(false);
  const [copiedJson, setCopiedJson] = React.useState(false);

  if (!event) return null;

  const copyToClipboard = (text: string, type: 'id' | 'json') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else {
      setCopiedJson(true);
      setTimeout(() => setCopiedJson(false), 2000);
    }
  };

  const decisionStyles = {
    Allowed: 'bg-[#15803d]/30 border-[#22c55e] text-[#4ade80]',
    Blocked: 'bg-[#b91c1c]/30 border-[#ef4444] text-[#f87171]',
    Review: 'bg-[#a16207]/30 border-[#eab308] text-[#fde047]',
  };

  const header = (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#292354] bg-[#1a1738] flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#25204d] border border-[#443a7b]">
          <PixelRobotIcon size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white">{event.id}</span>
            <button
              onClick={() => copyToClipboard(event.id, 'id')}
              className="text-[#8881b8] hover:text-white transition-colors"
              title="Copy ID"
            >
              {copiedId ? <Check size={13} className="text-[#22c55e]" /> : <Copy size={13} />}
            </button>
          </div>
          <div className="text-xs text-[#958fbe] font-medium mt-0.5">
            {event.timestamp}
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-[#958fbe] hover:text-white hover:bg-[#25204c] transition-colors"
        title="Close panel"
      >
        <X size={18} />
      </button>
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto p-5 space-y-4">
      {/* Status Banner */}
      <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#1b183a] border border-[#372f6a]">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-[#9c96c9]">Decision:</span>
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${decisionStyles[event.decision]}`}>
            {event.decision}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#9c96c9]">Risk Score:</span>
          <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold font-mono ${
            event.riskScore >= 75 ? 'bg-[#ef4444] text-white' : event.riskScore >= 40 ? 'bg-[#f59e0b] text-black' : 'bg-[#22c55e] text-white'
          }`}>
            <AnimatedNumber value={event.riskScore} />/100
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[#9c96c9]">Execution:</span>
          <span className="px-2 py-0.5 rounded-md bg-[#231f45] border border-[#3b3470] text-xs font-medium text-white">
            {event.execution}
          </span>
        </div>
      </div>

      {/* Action Summary */}
      {event.actionSummary && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1.5">
            Action Summary
          </label>
          <div className="p-3 bg-[#191637] border border-[#322a61] rounded-xl text-xs text-[#ded9f2] leading-relaxed">
            {event.actionSummary}
          </div>
        </div>
      )}

      {/* Key Attributes Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 bg-[#191637] border border-[#322a61] rounded-xl">
          <div className="text-[11px] text-[#857ea7] font-medium">Agent Identity</div>
          <div className="text-xs font-bold text-white mt-1 flex items-center gap-1.5">
            <PixelRobotIcon size={14} />
            <span>{event.agent}</span>
          </div>
        </div>

        <div className="p-3 bg-[#191637] border border-[#322a61] rounded-xl">
          <div className="text-[11px] text-[#857ea7] font-medium">Tool Invoked</div>
          <div className="text-xs font-mono font-bold text-[#c4bbf0] mt-1">
            {event.tool}
          </div>
        </div>

        <div className="p-3 bg-[#191637] border border-[#322a61] rounded-xl">
          <div className="text-[11px] text-[#857ea7] font-medium">Policy Enforced</div>
          <div className="text-xs font-semibold text-white mt-1">
            {event.policy}
          </div>
        </div>

        <div className="p-3 bg-[#191637] border border-[#322a61] rounded-xl">
          <div className="text-[11px] text-[#857ea7] font-medium">Source IP / Host</div>
          <div className="text-xs font-mono text-[#a59ecd] mt-1">
            {event.callerIp || '10.244.x.x'}
          </div>
        </div>
      </div>

      {/* Matched Policy & Rationale */}
      {event.policyMatchedRule && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1.5">
            Matched Policy Rule
          </label>
          <div className="p-3 bg-[#191637] border border-[#322a61] rounded-xl text-xs font-mono text-[#dcd6f7]">
            {event.policyMatchedRule}
          </div>
        </div>
      )}

      {event.decisionRationale && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1.5">
            Decision Rationale
          </label>
          <div className="p-3 bg-[#191637] border border-[#322a61] rounded-xl text-xs text-[#c2bcdd] leading-relaxed">
            {event.decisionRationale}
          </div>
        </div>
      )}

      {/* Risk Factors */}
      {event.riskFactors && event.riskFactors.length > 0 && (
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1.5">
            Evaluated Risk Signals
          </label>
          <ul className="space-y-1.5">
            {event.riskFactors.map((factor, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2 text-xs text-[#cdc7ea] bg-[#1a1738] border border-[#2e2759] p-2.5 rounded-lg"
              >
                <span className="text-[#a855f7] font-bold">•</span>
                <span>{factor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw Payload Inspection */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc]">
            Raw JSON Payload
          </label>
          <button
            onClick={() => copyToClipboard(JSON.stringify(event, null, 2), 'json')}
            className="text-[11px] font-medium text-[#a59ecd] hover:text-white flex items-center gap-1"
          >
            {copiedJson ? <Check size={12} className="text-[#22c55e]" /> : <Copy size={12} />}
            <span>{copiedJson ? 'Copied' : 'Copy JSON'}</span>
          </button>
        </div>
        <pre className="p-3 bg-[#100e23] border border-[#292254] rounded-xl text-[11px] font-mono text-[#a5b4fc] overflow-x-auto max-h-56">
          {JSON.stringify(
            {
              id: event.id,
              timestamp: event.timestamp,
              agent: event.agent,
              tool: event.tool,
              decision: event.decision,
              riskScore: event.riskScore,
              execution: event.execution,
              policy: event.policy,
              arguments: event.argumentsPayload,
              response: event.responsePayload,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );

  // Inline split-view panel (desktop) — same behaviour as the Review portal
  if (variant === 'panel') {
    return (
      <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners shadow-[0_4px_24px_rgba(0,0,0,0.45)] flex flex-col">
        <div className="w-full max-h-[calc(100vh-96px)] bg-[#16142e] pixel-corners flex flex-col overflow-hidden">
          {header}
          {body}
        </div>
      </div>
    );
  }

  // Mobile overlay drawer
  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden flex justify-end bg-black/60 backdrop-blur-xs ${
        isClosing ? 'portal-backdrop-exit' : 'portal-backdrop-enter'
      }`}
    >
      <div className="fixed inset-0" onClick={onClose} />

      <div
        className={`relative w-full max-w-xl h-full bg-[#15132d] border-l border-[#3a3273] shadow-2xl flex flex-col z-10 ${
          isClosing ? 'portal-drawer-exit' : 'portal-drawer-enter'
        }`}
      >
        {header}
        {body}
      </div>
    </div>
  );
};
