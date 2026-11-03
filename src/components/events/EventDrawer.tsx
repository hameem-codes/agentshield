import React, { useState } from 'react';
import {
  X,
  Copy,
  Check,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Terminal,
  Cpu,
  Globe,
  FileCode2,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';
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
  const [copiedId, setCopiedId] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

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

  // Determine visual color scheme based on decision
  const isAllowed = event.decision === 'Allowed';
  const isBlocked = event.decision === 'Blocked';

  const theme = isAllowed
    ? {
        accent: '#22c55e',
        badgeBg: 'bg-[#143e26]',
        badgeBorder: 'border-[#22c55e]/50',
        textColor: 'text-[#4ade80]',
        label: 'Allowed',
        sublabel: 'Verified Safe',
        icon: <ShieldCheck size={18} className="text-[#4ade80]" />,
        glow: 'shadow-[0_0_12px_rgba(34,197,94,0.25)]',
      }
    : isBlocked
    ? {
        accent: '#ef4444',
        badgeBg: 'bg-[#4a1923]',
        badgeBorder: 'border-[#ef4444]/50',
        textColor: 'text-[#f87171]',
        label: 'Blocked',
        sublabel: 'Policy Violation',
        icon: <ShieldAlert size={18} className="text-[#f87171]" />,
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.25)]',
      }
    : {
        accent: '#eab308',
        badgeBg: 'bg-[#423311]',
        badgeBorder: 'border-[#eab308]/50',
        textColor: 'text-[#facc15]',
        label: 'Review',
        sublabel: 'Human Inspection',
        icon: <Clock size={18} className="text-[#facc15]" />,
        glow: 'shadow-[0_0_12px_rgba(234,179,8,0.25)]',
      };

  // Risk gauge configuration
  const riskTier =
    event.riskScore >= 71
      ? { label: 'CRITICAL RISK', color: '#ef4444', bg: 'bg-[#4a1923]', text: 'text-[#f87171]' }
      : event.riskScore >= 31
      ? { label: 'MEDIUM RISK', color: '#eab308', bg: 'bg-[#423311]', text: 'text-[#facc15]' }
      : { label: 'LOW RISK', color: '#22c55e', bg: 'bg-[#143e26]', text: 'text-[#4ade80]' };

  // Helper for JSON syntax coloring
  const formatJsonHighlighted = (obj: any) => {
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

  const payloadSnippet = {
    id: event.id,
    timestamp: event.timestamp,
    agent: event.agent,
    tool: event.tool,
    decision: event.decision,
    riskScore: event.riskScore,
    execution: event.execution,
    policy: event.policy,
    argumentsPayload: event.argumentsPayload || {},
    responsePayload: event.responsePayload || {},
  };

  const header = (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#2a2455] bg-[#191637] flex-shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#26204e] border border-[#483d82] shadow-xs">
          <PixelRobotIcon size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white tracking-wide">{event.id}</span>
            <button
              onClick={() => copyToClipboard(event.id, 'id')}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono text-[#8b84bc] hover:text-white hover:bg-[#25204d] transition-colors"
              title="Copy Event ID"
            >
              {copiedId ? (
                <>
                  <Check size={12} className="text-[#22c55e]" />
                  <span className="text-[#22c55e]">Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="text-xs text-[#9d97cb] font-medium mt-0.5 flex items-center gap-1.5">
            <Clock size={11} className="text-[#7d77a8]" />
            <span>{event.timestamp}</span>
          </div>
        </div>
      </div>

      <button
        onClick={onClose}
        className="flex items-center justify-center w-8 h-8 rounded-lg text-[#958fbe] hover:text-white hover:bg-[#25204c] transition-colors cursor-pointer"
        title="Close panel"
      >
        <X size={18} />
      </button>
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
      {/* 1. HERO METRIC TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Decision Tile */}
        <div className={`p-3 rounded-xl border ${theme.badgeBg} ${theme.badgeBorder} ${theme.glow} flex flex-col justify-between`}>
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#9d97cb]">Decision</span>
            {theme.icon}
          </div>
          <div className="mt-2">
            <div className={`text-base font-bold font-mono tracking-tight ${theme.textColor}`}>
              {theme.label}
            </div>
            <div className="text-[11px] font-medium text-[#c4bbf0]/80 mt-0.5">
              {theme.sublabel}
            </div>
          </div>
        </div>

        {/* Risk Score Gauge Tile */}
        <div className="p-3 rounded-xl bg-[#181535] border border-[#372f6a] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#9d97cb]">Risk Engine</span>
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold font-mono ${riskTier.bg} ${riskTier.text} border border-[#503d98]/50`}>
              {riskTier.label}
            </span>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1 font-mono">
              <span className="text-xl font-bold text-white leading-none">
                <AnimatedNumber value={event.riskScore} />
              </span>
              <span className="text-[11px] text-[#7d77a8] font-bold">/100</span>
            </div>
            {/* Visual Gauge Bar */}
            <div className="w-full h-1.5 bg-[#252048] rounded-full mt-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(5, event.riskScore))}%`,
                  backgroundColor: riskTier.color,
                }}
              />
            </div>
          </div>
        </div>

        {/* Execution State Tile */}
        <div className="p-3 rounded-xl bg-[#181535] border border-[#372f6a] flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#9d97cb]">Runtime Action</span>
            <Cpu size={15} className="text-[#8e87bf]" />
          </div>
          <div className="mt-2">
            <div className="inline-flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  event.execution === 'Executed' ? 'bg-[#22c55e] animate-pulse' : 'bg-[#ef4444]'
                }`}
              />
              <span className="text-xs font-bold text-white font-mono">{event.execution}</span>
            </div>
            <div className="text-[11px] text-[#8e87bf] mt-0.5 font-mono">
              {event.callerIp || 'Local Runtime'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. ACTION OVERVIEW CARD */}
      <div className="p-3.5 bg-[#181535] border border-[#342c67] rounded-xl relative overflow-hidden">
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ backgroundColor: theme.accent }}
        />
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10.5px] uppercase font-bold tracking-wider text-[#9d97cb] flex items-center gap-1.5">
            <span>⚡</span>
            <span>Action Summary</span>
          </span>
          {event.targetResource && (
            <span className="text-[10.5px] font-mono text-[#a59ecd] bg-[#221c47] border border-[#3e3474] px-2 py-0.5 rounded-md truncate max-w-[200px]" title={event.targetResource}>
              {event.targetResource}
            </span>
          )}
        </div>
        <p className="text-xs text-[#e4e0f5] leading-relaxed font-medium">
          {event.actionSummary || 'Executed tool invocation with verified policy parameters.'}
        </p>
      </div>

      {/* 3. EXECUTION CONTEXT & SPECS */}
      <div className="bg-[#181535] border border-[#342c67] rounded-xl p-3.5">
        <div className="text-[10.5px] uppercase font-bold tracking-wider text-[#9d97cb] mb-2.5 flex items-center gap-1.5">
          <Terminal size={13} className="text-[#c084fc]" />
          <span>Execution Context</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {/* Agent Identity */}
          <div className="p-2.5 bg-[#14122d] border border-[#2b2554] rounded-lg">
            <span className="text-[10.5px] font-medium text-[#7d77a8] block">Agent Identity</span>
            <div className="flex items-center gap-1.5 mt-1 font-mono font-bold text-white text-xs">
              <PixelRobotIcon size={14} />
              <span>{event.agent}</span>
            </div>
          </div>

          {/* Tool Invoked */}
          <div className="p-2.5 bg-[#14122d] border border-[#2b2554] rounded-lg">
            <span className="text-[10.5px] font-medium text-[#7d77a8] block">Tool Invoked</span>
            <div className="mt-1 font-mono font-bold text-[#c4bbf0] text-xs">
              <span className="px-1.5 py-0.5 bg-[#251d52] border border-[#4f3d99] rounded text-[11px]">
                {event.tool}
              </span>
            </div>
          </div>

          {/* Policy Enforced */}
          <div className="p-2.5 bg-[#14122d] border border-[#2b2554] rounded-lg">
            <span className="text-[10.5px] font-medium text-[#7d77a8] block">Enforced Policy</span>
            <div className="mt-1 font-semibold text-[#e2dcfc] text-xs flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]" />
              <span>{event.policy}</span>
            </div>
          </div>

          {/* Source IP / Origin */}
          <div className="p-2.5 bg-[#14122d] border border-[#2b2554] rounded-lg">
            <span className="text-[10.5px] font-medium text-[#7d77a8] block">Source IP / Host</span>
            <div className="mt-1 font-mono text-[#a59ecd] text-xs flex items-center gap-1">
              <Globe size={11} className="text-[#6d3ee8]" />
              <span>{event.callerIp || '10.244.12.84'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SECURITY POLICY EVALUATION */}
      {(event.policyMatchedRule || event.decisionRationale) && (
        <div className="bg-[#181535] border border-[#342c67] rounded-xl p-3.5 space-y-2.5">
          <div className="text-[10.5px] uppercase font-bold tracking-wider text-[#9d97cb] flex items-center gap-1.5">
            <FileCode2 size={13} className="text-[#a855f7]" />
            <span>Policy Evaluation</span>
          </div>

          {event.policyMatchedRule && (
            <div className="p-2.5 bg-[#14122d] border border-[#2b2554] rounded-lg">
              <div className="text-[10.5px] font-mono font-semibold text-[#a78bfa] mb-1">
                Matched Security Rule
              </div>
              <div className="text-xs font-mono text-[#dcd7f2] leading-relaxed">
                {event.policyMatchedRule}
              </div>
            </div>
          )}

          {event.decisionRationale && (
            <div className="p-2.5 bg-[#1f1b40]/50 border-l-2 border-l-[#a855f7] border-y border-r border-[#2b2554] rounded-r-lg">
              <div className="text-[10.5px] font-medium text-[#9d97cb] mb-0.5">Decision Rationale</div>
              <div className="text-xs text-[#c5bee3] leading-relaxed">
                {event.decisionRationale}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. EVALUATED RISK SIGNALS (Clean cohesive panel) */}
      {event.riskFactors && event.riskFactors.length > 0 && (
        <div className="bg-[#181535] border border-[#342c67] rounded-xl p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[10.5px] uppercase font-bold tracking-wider text-[#9d97cb] flex items-center gap-1.5">
              <Info size={13} className="text-[#eab308]" />
              <span>Evaluated Risk Signals</span>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#241f47] border border-[#3b3472] text-[#c4bbf0]">
              {event.riskFactors.length} Signals
            </span>
          </div>

          <div className="divide-y divide-[#252048] border border-[#2b2554] rounded-lg overflow-hidden bg-[#14122d]">
            {event.riskFactors.map((factor, idx) => {
              const isWarning =
                factor.toLowerCase().includes('violation') ||
                factor.toLowerCase().includes('exceeded') ||
                factor.toLowerCase().includes('denied') ||
                factor.toLowerCase().includes('unrecognized');
              const isSuccess =
                factor.toLowerCase().includes('matches allowlist') ||
                factor.toLowerCase().includes('within normal') ||
                factor.toLowerCase().includes('no outbound');

              return (
                <div key={idx} className="flex items-start gap-2.5 p-2.5 hover:bg-[#1a1738] transition-colors">
                  <div className="mt-0.5 flex-shrink-0">
                    {isWarning ? (
                      <AlertTriangle size={13} className="text-[#ef4444]" />
                    ) : isSuccess ? (
                      <CheckCircle2 size={13} className="text-[#22c55e]" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7] inline-block my-1" />
                    )}
                  </div>
                  <span className="text-xs text-[#ded9f4] font-medium leading-relaxed">
                    {factor}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. RAW JSON TERMINAL INSPECTOR */}
      <div className="bg-[#131124] border border-[#2c2654] rounded-xl overflow-hidden shadow-lg">
        {/* Terminal Title Bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#1b1735] border-b border-[#2c2654]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]/80 inline-block" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/80 inline-block" />
            </div>
            <span className="text-[11px] font-mono text-[#8b84bc] font-medium ml-1">
              Event_Payload.json
            </span>
          </div>

          <button
            onClick={() => copyToClipboard(JSON.stringify(payloadSnippet, null, 2), 'json')}
            className="flex items-center gap-1 text-[11px] font-mono text-[#a59ecd] hover:text-white px-2 py-0.5 rounded hover:bg-[#28214f] transition-colors cursor-pointer"
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
          className="p-3.5 text-[11px] font-mono overflow-x-auto max-h-60 leading-relaxed select-text"
          dangerouslySetInnerHTML={{
            __html: formatJsonHighlighted(payloadSnippet),
          }}
        />
      </div>
    </div>
  );

  // Inline split-view panel (desktop)
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
