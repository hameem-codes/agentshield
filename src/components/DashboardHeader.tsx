import React, { useState } from 'react';
import { Calendar, RefreshCw, ChevronDown, Check } from 'lucide-react';
import { PixelHeaderBackdrop } from './pixel/PixelHeaderBackdrop';

interface DashboardHeaderProps {
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  onRefresh,
  isRefreshing = false,
}) => {
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState('Last 7 Days');

  const ranges = ['Last 24 Hours', 'Last 7 Days', 'Last 30 Days', 'This Month'];

  return (
    <div className="relative pt-2 pb-2 min-h-[80px] flex flex-col justify-center">
      {/* Pixel-art background scene (Setting Sun, Mountains, Castle, Clouds) across center-right */}
      <div className="absolute bottom-0 right-[205px] left-[320px] h-[66px] hidden lg:block opacity-95 overflow-hidden pointer-events-none">
        <PixelHeaderBackdrop className="w-full h-full" />
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* LEFT: GREETING & STATUS */}
        <div className="max-w-md">
          <h2 className="font-pixel text-[27px] md:text-[30px] font-bold text-white tracking-tight leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
            Good morning, Admin
          </h2>
          <p className="text-[13px] md:text-[13.5px] font-medium text-[#938ebf] mt-1.5">
            Here's the security status of your AI agents.
          </p>
        </div>

        {/* RIGHT: DATE-RANGE SELECTOR & REFRESH BUTTON */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          {/* Date Range Dropdown */}
          <div className="relative">
            <button
              onClick={() => setDateRangeOpen(!dateRangeOpen)}
              className="flex items-center gap-2 px-3.5 py-2 bg-[#1b1937] border border-[#372f6a] rounded-xl text-xs font-semibold text-white hover:border-[#554b9e] transition-colors shadow-sm"
            >
              <Calendar size={14} className="text-[#a29bcf]" />
              <span>{selectedRange}</span>
              <ChevronDown
                size={13}
                className={`text-[#8e87bf] transition-transform duration-200 ${
                  dateRangeOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {dateRangeOpen && (
              <div className="absolute right-0 mt-1.5 w-44 p-1 bg-[#191733] border border-[#3e3678] rounded-xl shadow-xl z-50">
                {ranges.map((range) => (
                  <button
                    key={range}
                    onClick={() => {
                      setSelectedRange(range);
                      setDateRangeOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                      selectedRange === range
                        ? 'bg-[#6d3ee8] text-white'
                        : 'text-[#aaa4d4] hover:bg-[#25204c] hover:text-white'
                    }`}
                  >
                    <span>{range}</span>
                    {selectedRange === range && <Check size={13} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Refresh Action Button */}
          <button
            onClick={onRefresh}
            title="Refresh security metrics"
            className="flex items-center justify-center w-8 h-8 bg-[#1b1937] border border-[#372f6a] rounded-lg text-[#a29bcf] hover:text-white hover:border-[#554b9e] active:scale-95 transition-all shadow-sm group"
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
