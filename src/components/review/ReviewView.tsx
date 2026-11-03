import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ReviewPageHeader } from './ReviewPageHeader';
import { ReviewKpiSection } from './ReviewKpiSection';
import { ReviewStatusTabs } from './ReviewStatusTabs';
import { ReviewToolbar } from './ReviewToolbar';
import { ReviewTable } from './ReviewTable';
import { ReviewDetailsPanel } from './ReviewDetailsPanel';
import { DenialModal } from './DenialModal';
import {
  INITIAL_PENDING_REQUESTS,
  INITIAL_APPROVED_REQUESTS,
  INITIAL_DENIED_REQUESTS,
  INITIAL_EXPIRED_REQUESTS,
} from './reviewData';
import { type TimeRangeKey } from '../../data/dashboardTimeRanges';
import type { ReviewRequest, ReviewStatus, ReviewFilterState } from './reviewTypes';

interface ReviewViewProps {
  onRefreshGlobal?: () => void;
  isRefreshingGlobal?: boolean;
  selectedTimeRange?: TimeRangeKey;
  onSelectTimeRange?: (range: TimeRangeKey) => void;
}

const REVIEW_STATS_BY_RANGE: Record<
  TimeRangeKey,
  { pending: number; approved: number; denied: number; expired: number }
> = {
  'Last 24 Hours': { pending: 2, approved: 8, denied: 4, expired: 1 },
  'Last 7 Days': { pending: 6, approved: 38, denied: 21, expired: 4 },
  'Last 30 Days': { pending: 14, approved: 162, denied: 88, expired: 19 },
  'This Month': { pending: 11, approved: 124, denied: 67, expired: 14 },
};

export const ReviewView: React.FC<ReviewViewProps> = ({
  onRefreshGlobal,
  isRefreshingGlobal = false,
  selectedTimeRange = 'Last 7 Days',
  onSelectTimeRange,
}) => {
  // Datasets for all 4 statuses
  const [pendingList, setPendingList] = useState<ReviewRequest[]>(INITIAL_PENDING_REQUESTS);
  const [approvedList, setApprovedList] = useState<ReviewRequest[]>(INITIAL_APPROVED_REQUESTS);
  const [deniedList, setDeniedList] = useState<ReviewRequest[]>(INITIAL_DENIED_REQUESTS);
  const [expiredList] = useState<ReviewRequest[]>(INITIAL_EXPIRED_REQUESTS);

  const [localDateRange, setLocalDateRange] = useState<TimeRangeKey>(selectedTimeRange);
  const activeDateRange = selectedTimeRange || localDateRange;

  const handleDateRangeChange = (rangeStr: string) => {
    const key = rangeStr as TimeRangeKey;
    setLocalDateRange(key);
    if (onSelectTimeRange) {
      onSelectTimeRange(key);
    }
  };

  // Status Tab
  const [currentStatus, setCurrentStatus] = useState<ReviewStatus>('Pending');

  // Selected Request — starts closed so the review portal only appears on demand
  const [selectedRequest, setSelectedRequest] = useState<ReviewRequest | null>(null);
  const [isDetailsClosing, setIsDetailsClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  // Denial modal state
  const [denyingRequest, setDenyingRequest] = useState<ReviewRequest | null>(null);

  // Filters state
  const [filters, setFilters] = useState<ReviewFilterState>({
    searchQuery: '',
    agent: 'All',
    tool: 'All',
    riskRange: 'All',
    sortBy: 'Newest',
  });

  const [localRefreshing, setLocalRefreshing] = useState(false);
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);

  // Notification message
  const [actionNotification, setActionNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setActionNotification(msg);
    setTimeout(() => setActionNotification(null), 3000);
  };

  // Clear any pending close timer when the view unmounts
  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const cancelCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  // Open the review portal
  const handleSelectRequest = (req: ReviewRequest) => {
    cancelCloseTimer();
    setIsDetailsClosing(false);
    setSelectedRequest(req);
    if (window.innerWidth < 1024) {
      setIsMobileDetailsOpen(true);
    }
  };

  // Close the review portal with slide-out transition
  const handleCloseDetails = () => {
    cancelCloseTimer();
    setIsDetailsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedRequest(null);
      setIsDetailsClosing(false);
      setIsMobileDetailsOpen(false);
      closeTimerRef.current = null;
    }, 220);
  };

  const handleFilterChange = <K extends keyof ReviewFilterState>(
    key: K,
    value: ReviewFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      agent: 'All',
      tool: 'All',
      riskRange: 'All',
      sortBy: 'Newest',
    });
  };

  // Range-driven statistics
  const stats = REVIEW_STATS_BY_RANGE[activeDateRange] || REVIEW_STATS_BY_RANGE['Last 7 Days'];

  // Pending count reflects current pending queue adjusted by timeframe
  const pendingCount =
    activeDateRange === 'Last 24 Hours'
      ? Math.min(2, pendingList.length)
      : Math.max(pendingList.length, stats.pending);
  const approvedCount = stats.approved + (approvedList.length - 1);
  const deniedCount = stats.denied + (deniedList.length - 1);
  const expiredCount = stats.expired;

  // Active dataset based on tab and active time range
  const activeDataset = useMemo(() => {
    switch (currentStatus) {
      case 'Pending':
        return activeDateRange === 'Last 24 Hours' ? pendingList.slice(0, 2) : pendingList;
      case 'Approved':
        return approvedList;
      case 'Denied':
        return deniedList;
      case 'Expired':
        return expiredList;
    }
  }, [currentStatus, pendingList, approvedList, deniedList, expiredList, activeDateRange]);

  // Filtered & Sorted records
  const filteredRequests = useMemo(() => {
    const list = activeDataset.filter((req) => {
      // 1. Search Query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchesId = req.id.toLowerCase().includes(q);
        const matchesDesc = req.description.toLowerCase().includes(q);
        const matchesAgent = req.agent.toLowerCase().includes(q);
        const matchesTool = req.tool.toLowerCase().includes(q);
        if (!matchesId && !matchesDesc && !matchesAgent && !matchesTool) {
          return false;
        }
      }

      // 2. Agent
      if (filters.agent !== 'All' && req.agent !== filters.agent) {
        return false;
      }

      // 3. Tool
      if (filters.tool !== 'All' && req.tool !== filters.tool) {
        return false;
      }

      // 4. Risk Range
      if (filters.riskRange !== 'All') {
        if (filters.riskRange === 'High (75+)' && req.riskScore < 75) return false;
        if (filters.riskRange === 'Medium (40-74)' && (req.riskScore < 40 || req.riskScore >= 75)) return false;
        if (filters.riskRange === 'Low (0-39)' && req.riskScore >= 40) return false;
      }

      return true;
    });

    // Sort
    return list.sort((a, b) => {
      switch (filters.sortBy) {
        case 'Newest':
          return b.requestedAtTimestamp - a.requestedAtTimestamp;
        case 'Oldest':
          return a.requestedAtTimestamp - b.requestedAtTimestamp;
        case 'Highest Risk':
          return b.riskScore - a.riskScore;
        case 'Lowest Risk':
          return a.riskScore - b.riskScore;
        default:
          return 0;
      }
    });
  }, [activeDataset, filters]);

  // Approval handler
  const handleApprove = (req: ReviewRequest) => {
    setPendingList((prev) => prev.filter((r) => r.id !== req.id));
    setApprovedList((prev) => [
      {
        ...req,
        status: 'Approved',
        approvedBy: 'Admin (You)',
        approvedAt: 'Just now',
        approvedAtTimestamp: Date.now(),
      },
      ...prev,
    ]);
    handleCloseDetails();
    showNotification(`Request ${req.id} Approved Successfully.`);
  };

  // Denial modal opening
  const handleDenyClick = (req: ReviewRequest) => {
    setDenyingRequest(req);
  };

  // Confirmed denial
  const handleConfirmDeny = (req: ReviewRequest, reason: string) => {
    setPendingList((prev) => prev.filter((r) => r.id !== req.id));
    setDeniedList((prev) => [
      {
        ...req,
        status: 'Denied',
        deniedBy: 'Admin (You)',
        deniedReason: reason,
        deniedAt: 'Just now',
        deniedAtTimestamp: Date.now(),
      },
      ...prev,
    ]);
    setDenyingRequest(null);
    handleCloseDetails();
    showNotification(`Request ${req.id} Denied (${reason}).`);
  };

  const handleRefresh = () => {
    setLocalRefreshing(true);
    if (onRefreshGlobal) onRefreshGlobal();
    setTimeout(() => {
      setLocalRefreshing(false);
    }, 600);
  };

  return (
    <main className="flex-1 px-5 py-3 md:px-6 md:py-3.5 max-w-[1536px] w-full mx-auto flex flex-col gap-3.5">
      {/* ACTION NOTIFICATION TOAST */}
      {actionNotification && (
        <div className="fixed top-20 right-8 z-50 px-4 py-2.5 rounded-xl bg-[#221c45] border border-[#6d3ee8] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
          <span>{actionNotification}</span>
        </div>
      )}

      {/* MAIN WORKSPACE: SPLIT VIEW (TABLE ON LEFT, DETAILS PANEL ON RIGHT) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* LEFT WORKSPACE (HEADER, KPIS, TABS, FILTERS & TABLE) — expands to full width when the portal is closed */}
        <div
          className={`flex flex-col min-w-0 transition-all duration-300 ${
            selectedRequest ? 'lg:col-span-8' : 'lg:col-span-12'
          }`}
        >
          {/* 1. REVIEW PAGE HEADER */}
          <ReviewPageHeader
            onRefresh={handleRefresh}
            isRefreshing={localRefreshing || isRefreshingGlobal}
            dateRange={activeDateRange}
            onDateRangeChange={handleDateRangeChange}
          />

          {/* 2. KPI CARDS */}
          <ReviewKpiSection
            pendingCount={pendingCount}
            approvedCount={approvedCount}
            deniedCount={deniedCount}
            expiredCount={expiredCount}
          />

          {/* 3. STATUS TABS */}
          <ReviewStatusTabs
            currentStatus={currentStatus}
            onSelectStatus={(status) => {
              setCurrentStatus(status);
              if (selectedRequest) handleCloseDetails();
            }}
            pendingCount={pendingCount}
            approvedCount={approvedCount}
            deniedCount={deniedCount}
            expiredCount={expiredCount}
          />

          {/* 4. FILTER TOOLBAR */}
          <ReviewToolbar
            filters={filters}
            onFilterChange={handleFilterChange}
            onResetFilters={handleResetFilters}
          />

          {/* 5. REQUESTS TABLE */}
          <ReviewTable
            requests={filteredRequests}
            selectedRequest={selectedRequest}
            onSelectRequest={handleSelectRequest}
          />
        </div>

        {/* RIGHT WORKSPACE: ANIMATED REVIEW PORTAL (4 OF 12 COLS) */}
        {selectedRequest && (
          <div
            key={selectedRequest.id}
            className={`hidden lg:block lg:col-span-4 sticky top-[76px] pt-2 ${
              isDetailsClosing ? 'portal-shell-exit' : 'portal-shell-enter'
            }`}
          >
            <ReviewDetailsPanel
              request={selectedRequest}
              onClose={handleCloseDetails}
              onApprove={handleApprove}
              onDeny={handleDenyClick}
            />
          </div>
        )}
      </div>

      {/* MOBILE / TABLET ANIMATED REVIEW PORTAL DRAWER */}
      {isMobileDetailsOpen && (
        <div
          className={`fixed inset-0 z-50 lg:hidden flex justify-end bg-black/60 backdrop-blur-xs ${
            isDetailsClosing ? 'portal-backdrop-exit' : 'portal-backdrop-enter'
          }`}
        >
          <div className="fixed inset-0" onClick={handleCloseDetails} />
          <div
            className={`relative w-full max-w-md h-full z-10 ${
              isDetailsClosing ? 'portal-drawer-exit' : 'portal-drawer-enter'
            }`}
          >
            <ReviewDetailsPanel
              request={selectedRequest}
              onClose={handleCloseDetails}
              onApprove={(req) => {
                handleApprove(req);
                handleCloseDetails();
              }}
              onDeny={(req) => {
                handleDenyClick(req);
                handleCloseDetails();
              }}
            />
          </div>
        </div>
      )}

      {/* DENIAL REASON MODAL */}
      <DenialModal
        request={denyingRequest}
        onClose={() => setDenyingRequest(null)}
        onConfirmDeny={handleConfirmDeny}
      />
    </main>
  );
};
