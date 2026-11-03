import React from 'react';
import { PixelRobotIcon } from './pixel/PixelIcons';
import { X, AlertCircle } from 'lucide-react';
import type { AlertNotification } from '../types';

interface PixelAlertToastProps {
  alert: AlertNotification | null;
  onDismiss: () => void;
  onViewEvent: (alert: AlertNotification) => void;
}

export const PixelAlertToast: React.FC<PixelAlertToastProps> = ({
  alert,
  onDismiss,
  onViewEvent,
}) => {
  if (!alert) return null;

  const severityStyles = {
    critical: {
      border: 'border-[#ef4444]',
      glow: 'shadow-[0_0_20px_rgba(239,68,68,0.35)]',
      tag: 'bg-[#ef4444] text-white',
      accent: 'text-[#ef4444]',
      bg: 'bg-[#1e1529]',
    },
    warning: {
      border: 'border-[#eab308]',
      glow: 'shadow-[0_0_20px_rgba(234,179,8,0.35)]',
      tag: 'bg-[#eab308] text-black',
      accent: 'text-[#eab308]',
      bg: 'bg-[#1f1b27]',
    },
    info: {
      border: 'border-[#a855f7]',
      glow: 'shadow-[0_0_20px_rgba(168,85,247,0.35)]',
      tag: 'bg-[#a855f7] text-white',
      accent: 'text-[#c084fc]',
      bg: 'bg-[#181634]',
    },
    success: {
      border: 'border-[#22c55e]',
      glow: 'shadow-[0_0_20px_rgba(34,197,94,0.35)]',
      tag: 'bg-[#22c55e] text-white',
      accent: 'text-[#4ade80]',
      bg: 'bg-[#152323]',
    },
  }[alert.severity];

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-5 duration-300">
      <div
        className={`relative p-4 rounded-2xl border-2 ${severityStyles.border} ${severityStyles.bg} ${severityStyles.glow} backdrop-blur-md shadow-2xl`}
      >
        {/* Top bar with Agent Name, Severity Badge, and Close Button */}
        <div className="flex items-center justify-between pb-2 border-b border-[#352d68]/60">
          <div className="flex items-center gap-2">
            <PixelRobotIcon size={18} />
            <span className="text-xs font-bold text-white font-mono">
              {alert.agent}
            </span>
            <span className="text-xs text-[#a59fcf] font-medium">Needs Attention</span>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded-sm uppercase tracking-wider ${severityStyles.tag}`}
            >
              Risk {alert.riskScore}
            </span>
            <button
              onClick={onDismiss}
              className="p-1 text-[#8f88be] hover:text-white rounded-md transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Reason text */}
        <div className="py-2.5">
          <p className="text-xs text-[#d1ccf2] leading-relaxed flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0">
              <AlertCircle size={14} className={severityStyles.accent} />
            </span>
            <span>{alert.reason}</span>
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#352d68]/40">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-xs font-medium text-[#a7a0d4] hover:text-white hover:bg-[#282352] rounded-lg transition-colors"
          >
            Dismiss
          </button>
          <button
            onClick={() => onViewEvent(alert)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-[#6d3ee8] hover:bg-[#7e50f5] active:scale-95 rounded-lg shadow-sm transition-all"
          >
            View Event
          </button>
        </div>
      </div>
    </div>
  );
};
