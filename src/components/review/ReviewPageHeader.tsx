import React, { useState } from 'react';
import { Calendar, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { PixelHeaderBackdrop } from '../pixel/PixelHeaderBackdrop';

interface ReviewPageHeaderProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

export const ReviewPageHeader: React.FC<ReviewPageHeaderProps> = ({
  onRefresh,
  isRefreshing = false,
  dateRange,
  onDateRangeChange,
}) => {
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const ranges = ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'This Month'];

  return (
    <div className="relative pt-1 pb-3">
      {/* Pixel-art background scene (Sunset Moon, Silhouette Castle & Towers) */}
      <div className="absolute top-0 right-32 left-[280px] h-20 hidden lg:block opacity-95 overflow-hidden pointer-events-none">
        <PixelHeaderBackdrop className="w-full h-full" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* LEFT: TITLE & SUBTITLE */}
        <div>
          <h2 className="text-[26px] md:text-[28px] font-bold text-white tracking-tight leading-tight">
            Review
          </h2>
          <p className="text-[13.5px] font-medium text-[#938ebf] mt-0.5">
            Actions that require human approval before execution.
          </p>
        </div>

        {/* RIGHT: LAST 7 DAYS + REFRESH */}
        <div className="flex items-center gap-2.5 self-start md:self-auto relative z-20">
          {/* 1. Date Range Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDateRangeOpen(!dateRangeOpen)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1b1937] border border-[#3a3270] rounded-xl text-xs font-semibold text-white hover:border-[#584ea4] transition-colors shadow-sm"
            >
              <Calendar size={14} className="text-[#a29bcf]" />
              <span>{dateRange}</span>
              <ChevronDown
                size={13}
                className={`text-[#8e87bf] transition-transform duration-200 ${
                  dateRangeOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {dateRangeOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-1 bg-[#191733] border border-[#3e3678] rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                {ranges.map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      onDateRangeChange(range);
                      setDateRangeOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                      dateRange === range
                        ? 'bg-[#6d3ee8] text-white'
                        : 'text-[#aaa4d4] hover:bg-[#25204c] hover:text-white'
                    }`}
                  >
                    <span>{range}</span>
                    {dateRange === range && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 2. Refresh Action Button */}
          <button
            onClick={onRefresh}
            title="Refresh review requests"
            className="flex items-center justify-center w-8 h-8 bg-[#1b1937] border border-[#3a3270] rounded-xl text-[#a29bcf] hover:text-white hover:border-[#584ea4] active:scale-95 transition-all shadow-sm group"
          >
            <RefreshCw
              size={14}
              className={`transition-transform duration-500 ${
                isRefreshing ? 'animate-spin text-[#c4bbf0]' : 'group-hover:rotate-180'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
