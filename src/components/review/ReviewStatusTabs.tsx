import React from 'react';
import type { ReviewStatus } from './reviewTypes';
import { AnimatedNumber } from '../pixel/AnimatedNumber';

interface ReviewStatusTabsProps {
  currentStatus: ReviewStatus;
  onSelectStatus: (status: ReviewStatus) => void;
  pendingCount: number;
  approvedCount: number;
  deniedCount: number;
  expiredCount: number;
}

export const ReviewStatusTabs: React.FC<ReviewStatusTabsProps> = ({
  currentStatus,
  onSelectStatus,
  pendingCount,
  approvedCount,
  deniedCount,
  expiredCount,
}) => {
  const tabs: { status: ReviewStatus; label: string; count: number }[] = [
    { status: 'Pending', label: 'Pending', count: pendingCount },
    { status: 'Approved', label: 'Approved', count: approvedCount },
    { status: 'Denied', label: 'Denied', count: deniedCount },
    { status: 'Expired', label: 'Expired', count: expiredCount },
  ];

  return (
    <div className="flex items-center gap-2 mb-3.5 select-none overflow-x-auto pb-0.5">
      {tabs.map((tab) => {
        const isActive = currentStatus === tab.status;

        return (
          <button
            key={tab.status}
            data-tab={tab.status}
            onClick={() => onSelectStatus(tab.status)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-150 ${
              isActive
                ? 'bg-[#6d3ee8] text-white shadow-[0_2px_10px_rgba(109,62,232,0.4)]'
                : 'bg-[#181635] border border-[#3b3472] text-[#a59ecd] hover:text-white hover:border-[#584ea4]'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-1.5 py-0.2 rounded-md font-mono text-[11px] font-bold ${
                isActive
                  ? 'bg-[#5527ca] text-white'
                  : 'bg-[#25204c] text-[#a59ecd]'
              }`}
            >
              <AnimatedNumber value={tab.count} />
            </span>
          </button>
        );
      })}
    </div>
  );
};
