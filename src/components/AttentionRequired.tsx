import React from 'react';
import {
  PixelWarningTriangleIcon,
  PixelClockCircleIcon,
  PixelPauseBarsIcon,
  PixelCrossShieldIcon,
  PixelSlidersIcon,
} from './pixel/PixelIcons';
import { PixelCard } from './pixel/PixelCard';
import { AnimatedNumber } from './pixel/AnimatedNumber';
import { ChevronRight } from 'lucide-react';
import type { AttentionItem } from '../types';

interface AttentionRequiredProps {
  onSelectItem: (item: AttentionItem) => void;
}

export const AttentionRequired: React.FC<AttentionRequiredProps> = ({ onSelectItem }) => {
  const items: AttentionItem[] = [
    {
      id: 'review-actions',
      iconType: 'review',
      text: '6 actions awaiting review',
      count: 6,
      severity: 'yellow',
      details: 'Supervisory sign-off required for file system write permissions across ops-agent.',
    },
    {
      id: 'paused-agent',
      iconType: 'paused',
      text: '1 agent is paused',
      count: 1,
      severity: 'orange',
      details: 'email-agent auto-paused following anomalous credential spray detection.',
    },
    {
      id: 'high-risk',
      iconType: 'risk',
      text: '17 high-risk events (≥ 61)',
      count: 17,
      severity: 'red',
      details: '17 events flagged with elevated heuristic risk in the last evaluation cycle.',
    },
    {
      id: 'policy-changes',
      iconType: 'policy',
      text: '2 policy changes in last 24h',
      count: 2,
      severity: 'purple',
      details: 'Updated Research v2 sandbox definitions and restricted outbound ports.',
    },
  ];

  const getIcon = (type: AttentionItem['iconType']) => {
    switch (type) {
      case 'review':
        return <PixelClockCircleIcon size={15} />;
      case 'paused':
        return <PixelPauseBarsIcon size={14} />;
      case 'risk':
        return <PixelCrossShieldIcon size={15} />;
      case 'policy':
        return <PixelSlidersIcon size={15} />;
    }
  };

  const renderAnimatedText = (text: string) => {
    const match = text.match(/(\d[\d,]*)/);
    if (!match || match.index === undefined) return text;

    const numericValue = parseInt(match[0].replace(/,/g, ''), 10);
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + match[0].length);

    return (
      <>
        {before}
        <AnimatedNumber value={numericValue} />
        {after}
      </>
    );
  };

  return (
    <PixelCard className="h-full flex-1" innerClassName="p-3.5 justify-between h-full">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-[#25204c]">
        <div className="flex items-center gap-1.5">
          <div className="flex items-center justify-center text-yellow-400">
            <PixelWarningTriangleIcon size={16} />
          </div>
          <h3 className="text-[13.5px] font-bold text-white tracking-tight">
            Attention Required
          </h3>
        </div>

        {/* Purple Badge 6 */}
        <span className="px-1.5 py-0.5 text-[10.5px] font-bold rounded-md bg-[#6d3ee8] text-white shadow-[0_1px_4px_rgba(109,62,232,0.4)]">
          <AnimatedNumber value={6} />
        </span>
      </div>

      {/* Rows */}
      <div className="flex flex-col justify-between gap-1.5 my-auto py-1">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectItem(item)}
            className="flex items-center justify-between w-full py-2 px-2 rounded-lg text-left hover:bg-[#201d44] transition-colors group"
          >
            <div className="flex items-center gap-2.5">
              <div className="flex-shrink-0 flex items-center justify-center">
                {getIcon(item.iconType)}
              </div>
              <span className="text-white text-[12.5px] font-medium group-hover:text-[#c4bbf0] transition-colors">
                {renderAnimatedText(item.text)}
              </span>
            </div>

            <ChevronRight
              size={14}
              className="text-[#7d77a8] group-hover:text-white group-hover:translate-x-0.5 transition-all"
            />
          </button>
        ))}
      </div>
    </PixelCard>
  );
};
