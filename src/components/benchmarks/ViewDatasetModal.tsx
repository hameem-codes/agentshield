import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  X,
  Search,
  ChevronDown,
  ChevronRight,
  Terminal,
  Copy,
  Check,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react';
import { PixelRobotIcon } from '../pixel/PixelIcons';
import { BENCHMARK_TEST_CASES_V1 } from './benchmarkData';
import type { TestCaseRecord } from './benchmarkTypes';

interface ViewDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ViewDatasetModal: React.FC<ViewDatasetModalProps> = ({ isOpen, onClose }) => {
  const [filterType, setFilterType] = useState<'All' | 'Benign' | 'Malicious'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCategoryOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target as Node)
      ) {
        setIsCategoryOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsCategoryOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCategoryOpen]);

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
        const matchesCategory = tc.category.toLowerCase().includes(q);
        const matchesPayload = tc.payloadSummary.toLowerCase().includes(q);
        if (
          !matchesId &&
          !matchesDesc &&
          !matchesTool &&
          !matchesAgent &&
          !matchesCategory &&
          !matchesPayload
        ) {
          return false;
        }
      }
      return true;
    });
  }, [filterType, selectedCategory, searchQuery]);

  const stats = useMemo(() => {
    const total = BENCHMARK_TEST_CASES_V1.length;
    const benign = BENCHMARK_TEST_CASES_V1.filter((c) => c.type === 'Benign').length;
    const malicious = BENCHMARK_TEST_CASES_V1.filter((c) => c.type === 'Malicious').length;
    return { total, benign, malicious, categoriesCount: categories.length - 1 };
  }, [categories]);

  if (!isOpen) return null;

  const handleCopyPayload = (tc: TestCaseRecord) => {
    try {
      const parsed = JSON.parse(tc.payloadSummary);
      navigator.clipboard.writeText(JSON.stringify(parsed, null, 2));
    } catch {
      navigator.clipboard.writeText(tc.payloadSummary);
    }
    setCopiedId(tc.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatJsonHighlighted = (rawStr: string) => {
    try {
      const parsed = JSON.parse(rawStr);
      const formatted = JSON.stringify(parsed, null, 2);
      return formatted.replace(
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
    } catch {
      return `<span class="text-[#86efac]">${rawStr}</span>`;
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl xl:max-w-6xl p-[1.5px] bg-[#3a3273] pixel-corners shadow-[0_12px_40px_rgba(0,0,0,0.65)] flex flex-col max-h-[92vh]">
        <div className="w-full bg-[#131127] pixel-corners flex flex-col overflow-hidden max-h-[92vh]">
          {/* 1. TOP HEADER */}
          <div className="flex items-center justify-between px-5 py-3.5 bg-[#171434] border-b border-[#2a2455] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#231d4d] border border-[#48398e] shadow-sm flex-shrink-0 text-[#c4bbf0]">
                <Terminal size={17} className="text-[#a78bfa]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-bold text-white tracking-wide">
                    Benchmark Suite: V1.0 Security Test Vectors
                  </h3>
                  <span className="px-1.5 py-0.2 rounded text-[9.5px] font-mono font-bold bg-[#291f54] text-[#a78bfa] border border-[#4c3a9e]">
                    v1.0.4
                  </span>
                </div>
                <p className="text-[11.5px] text-[#938ebf] font-medium mt-0.5">
                  Standardized adversarial and benign action payloads for runtime policy verification
                </p>
              </div>
            </div>

            {/* Header Right: Stats Pills + Close */}
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-1.5 font-mono text-[10.5px]">
                <span className="px-2.5 py-1 rounded-md bg-[#14331e] border border-[#1f6638] text-[#4ade80] font-semibold flex items-center gap-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                  <span>{stats.benign} Benign</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#38161b] border border-[#78242c] text-[#f87171] font-semibold flex items-center gap-1 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                  <span>{stats.malicious} Malicious</span>
                </span>
                <span className="px-2.5 py-1 rounded-md bg-[#231b4b] border border-[#4d3d96] text-[#c4bbf0] font-semibold shadow-xs">
                  {stats.categoriesCount} Categories
                </span>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg text-[#958fbe] hover:text-white hover:bg-[#25204c] flex items-center justify-center transition-colors cursor-pointer ml-1"
                title="Close modal"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* 2. FILTER & SEARCH CONTROL TOOLBAR */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 px-5 py-2.5 bg-[#16142e] border-b border-[#251f49] flex-shrink-0">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f78ab] pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Test Vectors by ID, tool, prompt or payload..."
                className="w-full pl-8 pr-3 py-1.5 bg-[#0f0d22] border border-[#30285d] rounded-lg text-xs text-white placeholder-[#7871a3] focus:outline-none focus:border-[#7b4cf0] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#857ea7] hover:text-white text-xs"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Right: Type Tabs & Category Filter */}
            <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
              {/* Type Switcher */}
              <div className="flex items-center gap-1 p-0.5 bg-[#0e0c20] border border-[#2b2457] rounded-lg">
                {(['All', 'Benign', 'Malicious'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilterType(t)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold font-mono transition-all cursor-pointer flex items-center gap-1 ${
                      filterType === t
                        ? t === 'Benign'
                          ? 'bg-[#15803d] text-white shadow-xs'
                          : t === 'Malicious'
                          ? 'bg-[#ef4444] text-white shadow-xs'
                          : 'bg-[#6d3ee8] text-white shadow-xs'
                        : 'text-[#9c96c9] hover:text-white hover:bg-[#1a1738]'
                    }`}
                  >
                    {t === 'Benign' && <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]" />}
                    {t === 'Malicious' && <span className="w-1.5 h-1.5 rounded-full bg-[#f87171]" />}
                    <span>{t}</span>
                  </button>
                ))}
              </div>

              {/* Custom Cyber Category Dropdown */}
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                  className={`flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0e0c20] border rounded-lg text-[11px] font-medium transition-colors cursor-pointer min-w-[140px] ${
                    selectedCategory !== 'All'
                      ? 'border-[#6d3ee8] text-white bg-[#1e173d]'
                      : 'border-[#2b2457] text-[#dcd7f5] hover:border-[#4b3f88]'
                  }`}
                >
                  <span className="truncate max-w-[170px]">
                    {selectedCategory === 'All' ? 'All Categories' : selectedCategory}
                  </span>
                  <ChevronDown
                    size={12}
                    className={`text-[#8e87bf] transition-transform flex-shrink-0 ${
                      isCategoryOpen ? 'rotate-180 text-[#a78bfa]' : ''
                    }`}
                  />
                </button>

                {isCategoryOpen && (
                  <div className="absolute right-0 mt-1.5 w-64 p-1 bg-[#16132d] border border-[#3b3270] rounded-xl shadow-[0_8px_28px_rgba(0,0,0,0.65)] z-50 animate-in fade-in zoom-in-95 duration-100 max-h-64 overflow-y-auto">
                    {categories.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(c);
                          setIsCategoryOpen(false);
                        }}
                        className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-left transition-colors cursor-pointer ${
                          selectedCategory === c
                            ? 'bg-[#6d3ee8] text-white shadow-xs font-semibold'
                            : 'text-[#cdc7ea] hover:bg-[#25204c] hover:text-white'
                        }`}
                      >
                        <span className="truncate">{c === 'All' ? 'All Categories' : c}</span>
                        {selectedCategory === c && (
                          <Check size={12} className="text-white ml-1 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 3. TEST VECTORS TABLE / MATRIX */}
          <div className="flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <thead className="sticky top-0 z-10 bg-[#16132d] border-b border-[#28214f] text-[11px] font-semibold text-[#a59ecd] select-none">
                <tr>
                  <th className="py-2.5 px-3 w-28 whitespace-nowrap">Vector ID</th>
                  <th className="py-2.5 px-2.5 w-24 whitespace-nowrap">Type</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Description & Payload Summary</th>
                  <th className="py-2.5 px-2.5 w-32 whitespace-nowrap">Agent / Tool</th>
                  <th className="py-2.5 px-2.5 w-24 text-center whitespace-nowrap">Expected</th>
                  <th className="py-2.5 px-2.5 w-16 text-right whitespace-nowrap">Risk</th>
                  <th className="py-2.5 px-3 w-20 text-center whitespace-nowrap"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e1a3d] text-xs">
                {filteredCases.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[#8e87bf]">
                      <Terminal size={24} className="mx-auto mb-2 text-[#564e85]" />
                      <p className="text-xs font-medium">No Test Vectors matched your filter criteria.</p>
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setFilterType('All');
                          setSelectedCategory('All');
                        }}
                        className="mt-2 text-[11.5px] text-[#a78bfa] hover:underline cursor-pointer"
                      >
                        Reset all filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredCases.map((tc) => {
                    const isExpanded = expandedId === tc.id;
                    const isBenign = tc.type === 'Benign';

                    return (
                      <React.Fragment key={tc.id}>
                        <tr
                          onClick={() => toggleExpand(tc.id)}
                          className={`hover:bg-[#1a1738] transition-colors cursor-pointer group ${
                            isExpanded ? 'bg-[#181535]' : ''
                          }`}
                        >
                          {/* 1. Vector ID */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 font-mono text-[11.5px] font-bold text-[#93c5fd] whitespace-nowrap">
                              <ChevronRight
                                size={13}
                                className={`text-[#7c75a8] group-hover:text-white transition-transform ${
                                  isExpanded ? 'rotate-90 text-[#a78bfa]' : ''
                                }`}
                              />
                              <span>{tc.id}</span>
                            </span>
                          </td>

                          {/* 2. Type Pill */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-mono font-bold tracking-wide ${
                                isBenign
                                  ? 'bg-[#14331e] text-[#4ade80] border border-[#22c55e]/40'
                                  : 'bg-[#38161b] text-[#f87171] border border-[#ef4444]/40'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  isBenign ? 'bg-[#22c55e]' : 'bg-[#ef4444]'
                                }`}
                              />
                              <span>{tc.type.toUpperCase()}</span>
                            </span>
                          </td>

                          {/* 3. Description & Category */}
                          <td className="py-2.5 px-3 max-w-[320px] lg:max-w-[420px]">
                            <div className="space-y-0.5 pr-2">
                              <div className="text-[12px] font-semibold text-white leading-snug truncate">
                                {tc.description}
                              </div>
                              <div className="flex items-center gap-2 text-[10.5px] text-[#8e87bf]">
                                <span className="px-1.5 py-0.2 rounded bg-[#1e1a3b] border border-[#2f275c] text-[#a59ecd] font-medium whitespace-nowrap">
                                  {tc.category}
                                </span>
                                <span className="font-mono text-[#78719f] truncate">
                                  {tc.payloadSummary}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 4. Agent & Tool */}
                          <td className="py-2.5 px-2.5 whitespace-nowrap">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-[#cdc7ea] text-[11px] font-medium">
                                <span className="text-[#a5b4fc]">
                                  <PixelRobotIcon size={13} />
                                </span>
                                <span>{tc.agent}</span>
                              </div>
                              <span className="inline-block px-1.5 py-0.2 rounded bg-[#121025] border border-[#2f275e] text-[#93c5fd] font-mono text-[10.5px]">
                                {tc.tool}
                              </span>
                            </div>
                          </td>

                          {/* 5. Expected Outcome */}
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            {tc.expectedOutcome === 'Allowed' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#133822] border border-[#22c55e]/50 text-[#4ade80] font-mono text-[11px] font-semibold shadow-xs">
                                <CheckCircle2 size={11} className="text-[#22c55e]" />
                                <span>Allowed</span>
                              </span>
                            ) : tc.expectedOutcome === 'Blocked' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3d1822] border border-[#ef4444]/50 text-[#f87171] font-mono text-[11px] font-semibold shadow-xs">
                                <XCircle size={11} className="text-[#ef4444]" />
                                <span>Blocked</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#3d2f14] border border-[#eab308]/50 text-[#fde047] font-mono text-[11px] font-semibold shadow-xs">
                                <Clock size={11} className="text-[#eab308]" />
                                <span>Review</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Baseline Risk Score */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span
                              className={`font-mono font-bold text-[12px] ${
                                tc.riskScore >= 70
                                  ? 'text-[#f87171]'
                                  : tc.riskScore >= 30
                                  ? 'text-[#facc15]'
                                  : 'text-[#4ade80]'
                              }`}
                            >
                              {tc.riskScore}
                            </span>
                            <span className="text-[#6d6692] font-mono text-[10px]">/100</span>
                          </td>

                          {/* 7. Action pill / inspect */}
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(tc.id);
                              }}
                              className="text-[10.5px] font-mono text-[#a59ecd] hover:text-white px-2.5 py-1 rounded-md bg-[#1e1a3b] hover:bg-[#2b2554] border border-[#342c67] hover:border-[#524498] transition-all cursor-pointer shadow-xs whitespace-nowrap"
                            >
                              {isExpanded ? 'Hide' : 'Inspect'}
                            </button>
                          </td>
                        </tr>

                        {/* EXPANDABLE RETRO CYBER INSPECTOR DRAWER */}
                        {isExpanded && (
                          <tr className="bg-[#0e0c20]/90">
                            <td colSpan={7} className="p-4 border-y border-[#2b2459]">
                              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                                {/* Left: Action Payload Terminal Window */}
                                <div className="lg:col-span-7 bg-[#0b091a] border border-[#2c2459] rounded-xl overflow-hidden shadow-md">
                                  {/* Window Title Bar */}
                                  <div className="flex items-center justify-between px-3 py-1.5 bg-[#171432] border-b border-[#28204e]">
                                    <div className="flex items-center gap-2">
                                      <div className="flex items-center gap-1.5">
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/90 inline-block shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]/90 inline-block shadow-[0_0_6px_rgba(234,179,8,0.4)]" />
                                        <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/90 inline-block shadow-[0_0_6px_rgba(34,197,94,0.4)]" />
                                      </div>
                                      <span className="text-[11px] font-mono text-[#a5b4fc] font-semibold flex items-center gap-1.5 ml-1">
                                        <Terminal size={12} className="text-[#818cf8]" />
                                        <span>test_vector_{tc.id.toLowerCase()}.json</span>
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCopyPayload(tc);
                                      }}
                                      className="flex items-center gap-1 text-[11px] font-mono text-[#a59ecd] hover:text-white px-2 py-0.5 rounded hover:bg-[#251f47] transition-all cursor-pointer"
                                      title="Copy action payload"
                                    >
                                      {copiedId === tc.id ? (
                                        <>
                                          <Check size={11} className="text-[#22c55e]" />
                                          <span className="text-[#22c55e]">Copied</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy size={11} />
                                          <span>Copy JSON</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {/* Code pre */}
                                  <pre
                                    className="p-3 text-[11.5px] font-mono leading-relaxed overflow-x-auto select-text max-h-48"
                                    dangerouslySetInnerHTML={{
                                      __html: formatJsonHighlighted(tc.payloadSummary),
                                    }}
                                  />
                                </div>

                                {/* Right: Security Evaluation Specification */}
                                <div className="lg:col-span-5 flex flex-col justify-between gap-2.5 bg-[#14122d] border border-[#2b2554] rounded-xl p-3.5 shadow-sm">
                                  <div>
                                    <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-[#9d97cb] flex items-center gap-1.5 mb-1.5">
                                      <Shield size={12} className="text-[#a78bfa]" />
                                      <span>Matched Security Policy Rule</span>
                                    </span>
                                    <div className="p-2.5 rounded-lg bg-[#0e0c20] border border-[#28224d] text-xs font-mono text-[#dcd7f2] leading-relaxed">
                                      {tc.policyRule}
                                    </div>
                                  </div>

                                  <div className="space-y-1.5 pt-2 border-t border-[#231e45] text-[11px]">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[#8e87bf]">Expected Outcome</span>
                                      <span className="font-mono font-bold text-white">
                                        {tc.expectedOutcome}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[#8e87bf]">Baseline Threat Score</span>
                                      <span className="font-mono font-bold text-[#facc15]">
                                        {tc.riskScore} / 100
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                      <span className="text-[#8e87bf]">Evaluation Class</span>
                                      <span className="font-mono text-[#c4bbf0]">{tc.category}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* 4. MODAL FOOTER */}
          <div className="flex items-center justify-between px-5 py-3 bg-[#15122f] border-t border-[#251f49] text-xs text-[#9d97c7] flex-shrink-0">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-white font-mono">{filteredCases.length}</strong> of{' '}
                <strong className="text-white font-mono">{BENCHMARK_TEST_CASES_V1.length}</strong> Test Vectors
              </span>
              {(filterType !== 'All' || selectedCategory !== 'All' || searchQuery) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterType('All');
                    setSelectedCategory('All');
                  }}
                  className="ml-2 text-[11px] font-medium text-[#a78bfa] hover:text-white underline cursor-pointer"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-[#251f4c] hover:bg-[#342c67] border border-[#48398e] text-white font-bold text-xs tracking-wide transition-all shadow-sm cursor-pointer"
            >
              Close Inspector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
