import React from 'react';
import {
  PixelLayersIcon,
  PixelCheckCircleIcon,
  PixelCrossShieldIcon,
  PixelClockCircleIcon,
} from './pixel/PixelIcons';
import { PixelCard } from './pixel/PixelCard';
import { AnimatedNumber } from './pixel/AnimatedNumber';
import { ArrowRight } from 'lucide-react';
import type { SecurityEvent } from '../types';
import { DASHBOARD_TIME_RANGES, type RecentEventData } from '../data/dashboardTimeRanges';

interface RecentEventsListProps {
  onSelectEvent: (event: SecurityEvent) => void;
  onViewAll: () => void;
  eventsData?: RecentEventData[];
}

export const RecentEventsList: React.FC<RecentEventsListProps> = ({
  onSelectEvent,
  onViewAll,
  eventsData = DASHBOARD_TIME_RANGES['Last 7 Days'].recentEvents,
}) => {
  const getStatusIcon = (decision: string) => {
    switch (decision) {
      case 'Allowed':
        return (
          <div className="text-[#4ade80]">
            <PixelCheckCircleIcon size={16} />
          </div>
        );
      case 'Blocked':
        return (
          <div className="text-[#f87171]">
            <PixelCrossShieldIcon size={16} />
          </div>
        );
      case 'Review':
        return (
          <div className="text-[#facc15]">
            <PixelClockCircleIcon size={16} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <PixelCard innerClassName="p-3.5 justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#231e47]">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center text-[#c084fc]">
            <PixelLayersIcon size={16} />
          </div>
          <h3 className="text-[13.5px] font-bold text-white tracking-tight">
            Recent Events
          </h3>
        </div>

        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-[11.5px] font-semibold text-[#8b84bd] hover:text-[#c4bbf0] transition-colors group cursor-pointer"
        >
          <span>View All</span>
          <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      {/* Event Items */}
      <div className="flex flex-col justify-between gap-1.5 my-auto py-1">
        {eventsData.map((evt) => (
          <button
            key={evt.id}
            onClick={() =>
              onSelectEvent({
                id: evt.id,
                agent: evt.agent,
                action: evt.action,
                decision: evt.decision,
                riskScore: evt.riskScore,
                timestamp: evt.timeAgo,
                payloadSummary: `${evt.agent} executing ${evt.action}`,
                reason: `${evt.decision} decision under active runtime policy.`,
              })
            }
            className="flex items-center justify-between w-full py-1.5 px-2 rounded-lg text-left hover:bg-[#201d44] transition-colors group cursor-pointer"
          >
            {/* Left: Status Icon + Event Name & Subtitle */}
            <div className="flex items-center gap-2.5">
              <div className="flex-shrink-0 flex items-center justify-center">
                {getStatusIcon(evt.decision)}
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-semibold text-white group-hover:text-[#c4bbf0] transition-colors font-mono">
                  {evt.agent} · {evt.action}
                </span>
                <span className="text-[11px] text-[#8680b5] font-medium">
                  {evt.decision} · Risk <AnimatedNumber value={evt.riskScore} />
                </span>
              </div>
            </div>

            {/* Right: Timestamp */}
            <span className="text-[11px] text-[#7d77a8] font-medium whitespace-nowrap pl-2">
              {evt.timeAgo}
            </span>
          </button>
        ))}
      </div>
    </PixelCard>
  );
};
