import React, { useState, useMemo } from 'react';
import { X, Search } from 'lucide-react';
import { PixelDatabaseIcon, PixelRobotIcon } from '../pixel/PixelIcons';
import { BENCHMARK_TEST_CASES_V1 } from './benchmarkData';

interface ViewDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ViewDatasetModal: React.FC<ViewDatasetModalProps> = ({ isOpen, onClose }) => {
  const [filterType, setFilterType] = useState<'All' | 'Benign' | 'Malicious'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const set = new Set(BENCHMARK_TEST_CASES_V1.map((c) => c.category));
    return ['All', ...Array.from(set)];
  }, []);

  const filteredCases = useMemo(() => {
    return BENCHMARK_TEST_CASES_V1.filter((tc) => {
      if (filterType !== 'All' && tc.type !== filterType) return false;
      if (selectedCategory !== 'All' && tc.category !== selectedCategory) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = tc.id.toLowerCase().includes(q);
        const matchesDesc = tc.description.toLowerCase().includes(q);
        const matchesTool = tc.tool.toLowerCase().includes(q);
        const matchesAgent = tc.agent.toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesTool && !matchesAgent) return false;
      }
      return true;
    });
  }, [filterType, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-4xl p-[2px] bg-[#3a3273] pixel-corners shadow-2xl max-h-[90vh] flex flex-col">
        <div className="w-full bg-[#16142e] pixel-corners p-5 flex flex-col overflow-hidden max-h-[90vh]">
          {/* HEADER */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#292254] flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#25204d] border border-[#443a7b]">
                <PixelDatabaseIcon size={16} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Benchmark Dataset: v1.0 Security Suite
                </h3>
                <p className="text-xs text-[#9d97c7]">
                  32 standardized test vectors for Agentic Runtime evaluation
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg text-[#958fbe] hover:text-white hover:bg-[#25204c] flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* TOOLBAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 py-3 border-b border-[#231e47] flex-shrink-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8780b8]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search test cases by ID, tool, or description..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#121025] border border-[#372f6a] rounded-xl text-xs text-white placeholder-[#7871a3] focus:outline-none focus:border-[#7b4cf0]"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#131027] border border-[#322a61] rounded-lg">
                {(['All', 'Benign', 'Malicious'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors cursor-pointer ${
                      filterType === t
                        ? 'bg-[#6d3ee8] text-white shadow-sm'
                        : 'text-[#9c96c9] hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Category Dropdown */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-2.5 py-1.5 bg-[#131027] border border-[#322a61] rounded-lg text-xs text-[#dcd7f5] font-medium focus:outline-none focus:border-[#7b4cf0]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* TEST CASES LIST */}
          <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
            {filteredCases.map((tc) => (
              <div
                key={tc.id}
                className="p-3 bg-[#191638] border border-[#312961] rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-xs">
                      {tc.id}
                    </span>
                    <span className="text-[11px] text-[#9d97c7]">
                      • {tc.category}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tc.type === 'Benign'
                          ? 'bg-[#15803d]/30 border border-[#22c55e]/40 text-[#4ade80]'
                          : 'bg-[#b91c1c]/30 border border-[#ef4444]/40 text-[#f87171]'
                      }`}
                    >
                      {tc.type}
                    </span>
                  </div>

                  <div className="text-white font-medium text-xs">
                    {tc.description}
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-[#8e87be] pt-0.5">
                    <span className="flex items-center gap-1">
                      <PixelRobotIcon size={12} />
                      <span>{tc.agent}</span>
                    </span>
                    <span>Tool: <strong className="font-mono text-[#c4bbf0]">{tc.tool}</strong></span>
                    <span>Rule: <strong className="text-[#dcd7f5]">{tc.policyRule}</strong></span>
                  </div>
                </div>

                {/* Expected & Score */}
                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-center gap-2 border-t md:border-t-0 border-[#2b2457] pt-2 md:pt-0">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold font-mono ${
                      tc.expectedOutcome === 'Allowed'
                        ? 'bg-[#15803d]/30 text-[#4ade80] border border-[#22c55e]'
                        : tc.expectedOutcome === 'Review'
                        ? 'bg-[#a16207]/30 text-[#fde047] border border-[#eab308]'
                        : 'bg-[#b91c1c]/30 text-[#f87171] border border-[#ef4444]'
                    }`}
                  >
                    Expected: {tc.expectedOutcome}
                  </span>
                  <span className="text-[11px] text-[#9d97c7] font-mono">
                    Risk: {tc.riskScore}/100
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* FOOTER */}
          <div className="pt-3 border-t border-[#292254] flex items-center justify-between text-xs text-[#9d97c7] flex-shrink-0">
            <span>Showing {filteredCases.length} of {BENCHMARK_TEST_CASES_V1.length} test vectors</span>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#221d47] hover:bg-[#2e275f] text-white font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

