import React, { useState } from 'react';
import { X, Shield } from 'lucide-react';
import type { SecurityPolicy, PolicyStatus } from './policyTypes';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policyToEdit: SecurityPolicy | null;
  onSavePolicy: (policy: Partial<SecurityPolicy>) => void;
}

export const PolicyModal: React.FC<PolicyModalProps> = ({
  isOpen,
  onClose,
  policyToEdit,
  onSavePolicy,
}) => {
  if (!isOpen) return null;

  return (
    <PolicyModalForm
      key={policyToEdit?.id || 'new-policy'}
      onClose={onClose}
      policyToEdit={policyToEdit}
      onSavePolicy={onSavePolicy}
    />
  );
};

const PolicyModalForm: React.FC<Omit<PolicyModalProps, 'isOpen'>> = ({
  onClose,
  policyToEdit,
  onSavePolicy,
}) => {
  const [name, setName] = useState(policyToEdit?.name || '');
  const [version, setVersion] = useState(policyToEdit?.version || 'V1.0.0');
  const [status, setStatus] = useState<PolicyStatus>(policyToEdit?.status || 'Active');
  const [description, setDescription] = useState(policyToEdit?.description || '');
  const [allowedToolsStr, setAllowedToolsStr] = useState(
    policyToEdit?.rules.allowedTools.join(', ') || 'Read_Web, Search_Web'
  );
  const [hostnamesStr, setHostnamesStr] = useState(
    policyToEdit?.rules.allowedHostnames.join(', ') || '*.wikipedia.org, docs.internal.com'
  );
  const [reviewThreshold, setReviewThreshold] = useState(
    policyToEdit?.rules.reviewThreshold ?? 60
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const allowedTools = allowedToolsStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const allowedHostnames = hostnamesStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    onSavePolicy({
      id: policyToEdit ? policyToEdit.id : `pol-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      version,
      status,
      description,
      rules: {
        allowedTools,
        argumentLimits: {
          maxItemsPerRequest: 10,
          maxFileSize: '50 MB',
        },
        allowedHostnames,
        defaultDeny: true,
        reviewThreshold,
        auditAllActions: true,
      },
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-[#16142e] border border-[#3a3273] rounded-2xl shadow-2xl p-5 z-10 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#292352]">
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-[#a5b4fc]" />
            <h3 className="text-base font-bold text-white">
              {policyToEdit ? 'Edit Security Policy' : 'Create New Security Policy'}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#8e87bf] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs text-[#cdc7ea]">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1">
              Policy Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="E.g. Research v3"
              className="w-full h-9 px-3 bg-[#191738] border border-[#3b3472] rounded-xl text-xs text-white focus:outline-none focus:border-[#6d3ee8]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1">
                Version Tag
              </label>
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="V1.0.0"
                className="w-full h-9 px-3 bg-[#191738] border border-[#3b3472] rounded-xl text-xs text-white focus:outline-none focus:border-[#6d3ee8] font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as PolicyStatus)}
                className="w-full h-9 px-3 bg-[#191738] border border-[#3b3472] rounded-xl text-xs text-white focus:outline-none focus:border-[#6d3ee8]"
              >
                <option value="Active">Active</option>
                <option value="Draft">Draft</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of policy scope"
              className="w-full h-9 px-3 bg-[#191738] border border-[#3b3472] rounded-xl text-xs text-white focus:outline-none focus:border-[#6d3ee8]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1">
              Allowed Tools (comma separated)
            </label>
            <input
              type="text"
              value={allowedToolsStr}
              onChange={(e) => setAllowedToolsStr(e.target.value)}
              placeholder="Read_Web, Search_Web, Download_File"
              className="w-full h-9 px-3 bg-[#191738] border border-[#3b3472] rounded-xl text-xs text-white focus:outline-none focus:border-[#6d3ee8] font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1">
              Allowed Destination Hostnames
            </label>
            <input
              type="text"
              value={hostnamesStr}
              onChange={(e) => setHostnamesStr(e.target.value)}
              placeholder="*.wikipedia.org, docs.internal.com"
              className="w-full h-9 px-3 bg-[#191738] border border-[#3b3472] rounded-xl text-xs text-white focus:outline-none focus:border-[#6d3ee8] font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#8b84bc] block mb-1">
              Human Review Threshold (Risk Score ≥ {reviewThreshold})
            </label>
            <input
              type="range"
              min={10}
              max={90}
              value={reviewThreshold}
              onChange={(e) => setReviewThreshold(Number(e.target.value))}
              className="w-full accent-[#6d3ee8]"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292352]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-[#231f45] border border-[#3a3270] text-xs font-semibold text-[#cdc7ea] hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-[#6d3ee8] hover:bg-[#5b2ec9] text-xs font-bold text-white shadow-md"
            >
              {policyToEdit ? 'Save Changes' : 'Create Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
