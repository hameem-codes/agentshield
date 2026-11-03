import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import type { ReviewRequest } from './reviewTypes';

interface DenialModalProps {
  request: ReviewRequest | null;
  onClose: () => void;
  onConfirmDeny: (req: ReviewRequest, reason: string) => void;
}

export const DenialModal: React.FC<DenialModalProps> = ({
  request,
  onClose,
  onConfirmDeny,
}) => {
  const [reason, setReason] = useState('High data exfiltration risk');

  if (!request) return null;

  const reasons = [
    'High data exfiltration risk',
    'Unverified external recipient/destination',
    'Destructive or permanent modification',
    'Policy violation under active runtime profile',
    'Other reason (manual review flag)',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />

      <div className="relative w-full max-w-md bg-[#16142e] border border-[#3a3273] rounded-2xl shadow-2xl p-5 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between pb-3 border-b border-[#292352]">
          <div className="flex items-center gap-2 text-[#ef4444]">
            <AlertTriangle size={20} />
            <h3 className="text-base font-bold text-white">Deny Request</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#8e87bf] hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 text-xs text-[#cdc7ea] space-y-3">
          <p>
            Are you sure you want to deny <span className="font-mono font-bold text-white">{request.id}</span> (
            <span className="font-semibold text-white">{request.title}</span>) proposed by{' '}
            <span className="font-semibold text-white">{request.agent}</span>?
          </p>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1.5">
              Select Denial Reason
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full h-9 px-3 bg-[#191738] border border-[#3b3472] rounded-xl text-xs text-white focus:outline-none focus:border-[#6d3ee8]"
            >
              {reasons.map((r) => (
                <option key={r} value={r} className="bg-[#191738] text-white">
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-[#292352]">
          <button
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl bg-[#231f45] border border-[#3a3270] text-xs font-semibold text-[#cdc7ea] hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirmDeny(request, reason)}
            className="px-4 py-2 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-xs font-bold text-white shadow-md"
          >
            Confirm Denial
          </button>
        </div>
      </div>
    </div>
  );
};

