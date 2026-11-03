import React, { useState } from 'react';
import {
  ArrowUpDown,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X,
  ExternalLink,
  Clock,
  Copy,
  Eye,
  Filter,
} from 'lucide-react';
import type { SecurityEventRecord } from './eventsTypes';
import { PixelRobotIcon } from '../pixel/PixelIcons';
import { AnimatedNumber } from '../pixel/AnimatedNumber';

interface EventsTableProps {
  events: SecurityEventRecord[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSelectEvent: (event: SecurityEventRecord) => void;
  onFilterByAgent: (agent: string) => void;
  onFilterByTool: (tool: string) => void;
  sortOrder: 'asc' | 'desc';
  onToggleSort: () => void;
}

export const EventsTable: React.FC<EventsTableProps> = ({
  events,
  totalCount,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onSelectEvent,
  onFilterByAgent,
  onFilterByTool,
  sortOrder,
  onToggleSort,
}) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [pageSizeOpen, setPageSizeOpen] = useState(false);

  const isAllSelected =
    events.length > 0 && events.every((e) => selectedIds.has(e.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(events.map((e) => e.id)));
    }
  };

  const toggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Pagination calculation
  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="relative p-[1.5px] bg-[#3a3273] pixel-corners shadow-[0_4px_24px_rgba(0,0,0,0.45)]">
      <div className="w-full bg-[#16142e] pixel-corners flex flex-col">
        {/* HORIZONTALLY SCROLLABLE TABLE CONTAINER */}
        <div className="w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            {/* TABLE HEADER */}
            <thead>
              <tr className="border-b border-[#292352] text-[#dcd7f2] text-xs font-semibold select-none bg-[#16142e]">
                {/* 1. Selection Checkbox */}
                <th className="py-3 px-3.5 w-10 text-center">
                  <button
                    onClick={toggleSelectAll}
                    title="Select all"
                    className={`w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${
                      isAllSelected
                        ? 'bg-[#6d3ee8] border-[#6d3ee8] text-white'
                        : 'bg-[#1b1836] border-[#443c7c] hover:border-[#6d3ee8]'
                    }`}
                  >
                    {isAllSelected && <Check size={11} strokeWidth={3} />}
                  </button>
                </th>

                {/* 2. Timestamp */}
                <th
                  onClick={onToggleSort}
                  title={`Sort by Timestamp (${sortOrder.toUpperCase()})`}
                  className="py-3 px-3.5 cursor-pointer hover:text-white transition-colors whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Timestamp</span>
                    <ArrowUpDown size={13} className={`transition-colors ${sortOrder === 'asc' ? 'text-[#c4bbf0]' : 'text-[#8e87bf]'}`} />
                  </div>
                </th>

                {/* 3. Event ID */}
                <th className="py-3 px-3.5 whitespace-nowrap">Event ID</th>

                {/* 4. Agent */}
                <th className="py-3 px-3.5 whitespace-nowrap">Agent</th>

                {/* 5. Tool */}
                <th className="py-3 px-3.5 whitespace-nowrap">Tool</th>

                {/* 6. Decision */}
                <th className="py-3 px-3.5 whitespace-nowrap">Decision</th>

                {/* 7. Risk Score */}
                <th className="py-3 px-3.5 whitespace-nowrap">Risk Score</th>

                {/* 8. Execution */}
                <th className="py-3 px-3.5 whitespace-nowrap">Execution</th>

                {/* 9. Policy */}
                <th className="py-3 px-3.5 whitespace-nowrap">Policy</th>

                {/* 10. Actions Header */}
                <th className="py-3 px-3.5 w-12 text-center"></th>
              </tr>
            </thead>

            {/* TABLE BODY */}
            <tbody className="divide-y divide-[#221e45] text-xs">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-[#8e87bf]">
                    No events found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  const isChecked = selectedIds.has(evt.id);

                  return (
                    <tr
                      key={evt.id}
                      onClick={() => onSelectEvent(evt)}
                      className={`hover:bg-[#1d193d] transition-colors cursor-pointer group ${
                        isChecked ? 'bg-[#221b47]' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td
                        className="py-3 px-3.5 text-center"
                        onClick={(e) => toggleSelectRow(evt.id, e)}
                      >
                        <button
                          type="button"
                          className={`w-4 h-4 rounded-sm flex items-center justify-center transition-colors border ${
                            isChecked
                              ? 'bg-[#6d3ee8] border-[#6d3ee8] text-white'
                              : 'bg-[#1b1836] border-[#443c7c] hover:border-[#6d3ee8]'
                          }`}
                        >
                          {isChecked && <Check size={11} strokeWidth={3} />}
                        </button>
                      </td>

                      {/* Timestamp */}
                      <td className="py-3 px-3.5 font-medium text-white whitespace-nowrap">
                        {evt.timestamp}
                      </td>

                      {/* Event ID */}
                      <td className="py-3 px-3.5 font-mono text-[#aba3d6] whitespace-nowrap">
                        {evt.id}
                      </td>

                      {/* Agent with Pixel Robot Icon */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="flex-shrink-0 text-[#a5b4fc]">
                            <PixelRobotIcon size={16} />
                          </span>
                          <span className="font-medium text-white">{evt.agent}</span>
                        </div>
                      </td>

                      {/* Tool */}
                      <td className="py-3 px-3.5 font-mono text-[#dcd7f2] whitespace-nowrap">
                        {evt.tool}
                      </td>

                      {/* Decision Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {evt.decision === 'Allowed' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#22c55e] text-white font-bold text-xs shadow-xs">
                            <Check size={12} strokeWidth={3} />
                            <span>Allowed</span>
                          </span>
                        )}
                        {evt.decision === 'Blocked' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#ef4444] text-white font-bold text-xs shadow-xs">
                            <X size={12} strokeWidth={3} />
                            <span>Blocked</span>
                          </span>
                        )}
                        {evt.decision === 'Review' && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#eab308] text-[#121124] font-bold text-xs shadow-xs">
                            <Clock size={12} strokeWidth={2.5} />
                            <span>Review</span>
                          </span>
                        )}
                      </td>

                      {/* Risk Score Pill */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center justify-center px-2.5 py-0.5 min-w-[32px] rounded-md font-mono font-bold text-xs text-white ${
                            evt.riskScore >= 75
                              ? 'bg-[#ef4444]'
                              : evt.riskScore >= 40
                              ? 'bg-[#f59e0b]'
                              : 'bg-[#22c55e]'
                          }`}
                        >
                          {evt.riskScore}
                        </span>
                      </td>

                      {/* Execution Badge */}
                      <td className="py-3 px-3.5 whitespace-nowrap">
                        {evt.execution === 'Executed' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#22c55e] text-[#0e0d21] font-bold text-xs">
                            <span>Executed</span>
                            <ExternalLink size={12} strokeWidth={2.5} />
                          </span>
                        )}
                        {evt.execution === 'Not Executed' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#221e45] border border-[#3c3575] text-[#d4cfea] font-semibold text-xs">
                            <span className="text-[11px] font-mono">&gt;</span>
                            <span>Not Executed</span>
                          </span>
                        )}
                        {evt.execution === 'Pending' && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#221e45] border border-[#3c3575] text-[#d4cfea] font-semibold text-xs">
                            <Clock size={12} className="text-[#a59ecd]" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* Policy */}
                      <td className="py-3 px-3.5 text-[#ded9f5] whitespace-nowrap">
                        {evt.policy}
                      </td>

                      {/* Actions Menu */}
                      <td
                        className="py-3 px-3.5 text-center relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            setActiveMenuId(activeMenuId === evt.id ? null : evt.id)
                          }
                          className="flex items-center justify-center w-7 h-7 rounded-lg text-[#8b84bc] hover:text-white hover:bg-[#25204c] transition-colors mx-auto"
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {/* Menu Dropdown */}
                        {activeMenuId === evt.id && (
                          <div className="absolute right-3 top-10 w-44 p-1 bg-[#191637] border border-[#3e3678] rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 text-left">
                            <button
                              onClick={() => {
                                onSelectEvent(evt);
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Eye size={13} />
                              <span>View Details</span>
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(evt.id);
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Copy size={13} />
                              <span>Copy Event ID</span>
                            </button>
                            <button
                              onClick={() => {
                                onFilterByAgent(evt.agent);
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Filter size={13} />
                              <span>Filter by Agent</span>
                            </button>
                            <button
                              onClick={() => {
                                onFilterByTool(evt.tool);
                                setActiveMenuId(null);
                              }}
                              className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#aaa4d4] hover:bg-[#25204c] hover:text-white"
                            >
                              <Filter size={13} />
                              <span>Filter by Tool</span>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#292352] bg-[#16142e] text-xs select-none">
          {/* Showing 1-8 of 3,842 events */}
          <div className="text-[#9c96c9] font-medium">
            Showing <span className="text-white font-mono"><AnimatedNumber value={startRecord} /></span>–
            <span className="text-white font-mono"><AnimatedNumber value={endRecord} /></span> of{' '}
            <span className="text-white font-mono"><AnimatedNumber value={totalCount} /></span> events
          </div>

          {/* Controls: Rows per page + Page numbers */}
          <div className="flex items-center gap-3">
            {/* Rows per page dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-[#9c96c9]">Rows per page</span>
              <div className="relative">
                <button
                  onClick={() => setPageSizeOpen(!pageSizeOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-[#1a1738] border border-[#3b3472] rounded-lg text-white font-semibold hover:border-[#584ea4] transition-colors"
                >
                  <span className="font-mono">{pageSize}</span>
                  <ChevronDown size={13} className="text-[#8e87bf]" />
                </button>

                {pageSizeOpen && (
                  <div className="absolute right-0 bottom-full mb-1 w-20 p-1 bg-[#191637] border border-[#3e3678] rounded-xl shadow-2xl z-50">
                    {[8, 16, 25, 50].map((sz) => (
                      <button
                        key={sz}
                        onClick={() => {
                          onPageSizeChange(sz);
                          setPageSizeOpen(false);
                        }}
                        className={`w-full px-2 py-1 text-xs font-mono rounded-lg transition-colors text-center ${
                          pageSize === sz
                            ? 'bg-[#6d3ee8] text-white'
                            : 'text-[#aaa4d4] hover:bg-[#25204c] hover:text-white'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Page Buttons: < 1 2 3 4 5 ... 480 > */}
            <div className="flex items-center gap-1">
              {/* Prev Button */}
              <button
                onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#1a1738] border border-[#3b3472] text-[#8e87bf] hover:text-white hover:border-[#584ea4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={14} />
              </button>

              {/* Page Numbers */}
              {[1, 2, 3, 4, 5].map((p) => (
                <button
                  key={p}
                  onClick={() => onPageChange(p)}
                  className={`flex items-center justify-center w-7 h-7 rounded-lg font-mono text-xs font-semibold transition-colors ${
                    currentPage === p
                      ? 'bg-[#2b1f59] border border-[#6d3ee8] text-white'
                      : 'text-[#9c96c9] hover:text-white hover:bg-[#1f1b3e]'
                  }`}
                >
                  {p}
                </button>
              ))}

              <span className="px-1 text-[#6e6894]">...</span>

              {/* Last Page (480) */}
              <button
                onClick={() => onPageChange(480)}
                className={`flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-lg font-mono text-xs font-semibold transition-colors ${
                  currentPage === 480
                    ? 'bg-[#2b1f59] border border-[#6d3ee8] text-white'
                    : 'text-[#9c96c9] hover:text-white hover:bg-[#1f1b3e]'
                }`}
              >
                480
              </button>

              {/* Next Button */}
              <button
                onClick={() => onPageChange(Math.min(480, currentPage + 1))}
                disabled={currentPage === 480}
                className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#1a1738] border border-[#3b3472] text-[#8e87bf] hover:text-white hover:border-[#584ea4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
