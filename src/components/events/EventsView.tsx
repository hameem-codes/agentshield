import React, { useState, useMemo, useEffect, useRef } from 'react';
import { EventsPageHeader } from './EventsPageHeader';
import { EventsKpiSection } from './EventsKpiSection';
import { EventsFilterToolbar } from './EventsFilterToolbar';
import { EventsTable } from './EventsTable';
import { EventDrawer } from './EventDrawer';
import { ALL_EVENTS, INITIAL_PRIMARY_EVENTS } from './eventsData';
import { DASHBOARD_TIME_RANGES, type TimeRangeKey } from '../../data/dashboardTimeRanges';
import type { SecurityEventRecord, EventsFilterState } from './eventsTypes';

interface EventsViewProps {
  onRefreshGlobal?: () => void;
  isRefreshingGlobal?: boolean;
  selectedTimeRange?: TimeRangeKey;
  onSelectTimeRange?: (range: TimeRangeKey) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({
  onRefreshGlobal,
  isRefreshingGlobal = false,
  selectedTimeRange = 'Last 7 Days',
  onSelectTimeRange,
}) => {
  // Filter state
  const [filters, setFilters] = useState<EventsFilterState>({
    searchQuery: '',
    decision: 'All',
    agent: 'All',
    tool: 'All',
    riskRange: 'All',
    execution: 'All',
    policy: 'All',
  });

  // Table state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [localDateRange, setLocalDateRange] = useState<TimeRangeKey>(selectedTimeRange);
  const [localRefreshing, setLocalRefreshing] = useState(false);

  // Active time range dataset
  const activeDateRange = selectedTimeRange || localDateRange;
  const currentRangeData = DASHBOARD_TIME_RANGES[activeDateRange] || DASHBOARD_TIME_RANGES['Last 7 Days'];

  const handleDateRangeChange = (r: string) => {
    const key = r as TimeRangeKey;
    setLocalDateRange(key);
    if (onSelectTimeRange) {
      onSelectTimeRange(key);
    }
  };

  // Selected event for detail drawer
  const [selectedEvent, setSelectedEvent] = useState<SecurityEventRecord | null>(null);
  const [isDrawerClosing, setIsDrawerClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

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

  // Open (or swap) the event drawer with an enter animation
  const handleSelectEvent = (evt: SecurityEventRecord) => {
    cancelCloseTimer();
    setIsDrawerClosing(false);
    setSelectedEvent(evt);
  };

  // Play the exit animation, then unmount the drawer
  const handleCloseDrawer = () => {
    cancelCloseTimer();
    setIsDrawerClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedEvent(null);
      setIsDrawerClosing(false);
      closeTimerRef.current = null;
    }, 220);
  };

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.searchQuery.trim()) count++;
    if (filters.decision !== 'All') count++;
    if (filters.agent !== 'All') count++;
    if (filters.tool !== 'All') count++;
    if (filters.riskRange !== 'All') count++;
    if (filters.execution !== 'All') count++;
    if (filters.policy !== 'All') count++;
    return count;
  }, [filters]);

  const handleFilterChange = <K extends keyof EventsFilterState>(
    key: K,
    value: EventsFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleClearAll = () => {
    setFilters({
      searchQuery: '',
      decision: 'All',
      agent: 'All',
      tool: 'All',
      riskRange: 'All',
      execution: 'All',
      policy: 'All',
    });
    setCurrentPage(1);
  };

  // Filtered dataset
  const filteredEvents = useMemo(() => {
    return ALL_EVENTS.filter((evt) => {
      // 1. Search query
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesId = evt.id.toLowerCase().includes(query);
        const matchesAgent = evt.agent.toLowerCase().includes(query);
        const matchesTool = evt.tool.toLowerCase().includes(query);
        const matchesPolicy = evt.policy.toLowerCase().includes(query);
        if (!matchesId && !matchesAgent && !matchesTool && !matchesPolicy) {
          return false;
        }
      }

      // 2. Decision
      if (filters.decision !== 'All' && evt.decision !== filters.decision) {
        return false;
      }

      // 3. Agent
      if (filters.agent !== 'All' && evt.agent !== filters.agent) {
        return false;
      }

      // 4. Tool
      if (filters.tool !== 'All' && evt.tool !== filters.tool) {
        return false;
      }

      // 5. Risk Range
      if (filters.riskRange !== 'All') {
        if (filters.riskRange === 'Low (0-30)' && (evt.riskScore < 0 || evt.riskScore > 30)) {
          return false;
        }
        if (filters.riskRange === 'Medium (31-70)' && (evt.riskScore < 31 || evt.riskScore > 70)) {
          return false;
        }
        if (filters.riskRange === 'High (71-100)' && (evt.riskScore < 71 || evt.riskScore > 100)) {
          return false;
        }
      }

      // 6. Execution
      if (filters.execution !== 'All' && evt.execution !== filters.execution) {
        return false;
      }

      // 7. Policy
      if (filters.policy !== 'All' && evt.policy !== filters.policy) {
        return false;
      }

      return true;
    });
  }, [filters]);

  // Sorted dataset
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      return sortOrder === 'desc'
        ? b.timestampRaw - a.timestampRaw
        : a.timestampRaw - b.timestampRaw;
    });
  }, [filteredEvents, sortOrder]);

  // Paginated dataset
  const paginatedEvents = useMemo(() => {
    if (currentPage === 1 && activeFilterCount === 0 && sortOrder === 'desc') {
      return INITIAL_PRIMARY_EVENTS.slice(0, pageSize);
    }
    const startIndex = (currentPage - 1) * pageSize;
    return sortedEvents.slice(startIndex, startIndex + pageSize);
  }, [sortedEvents, currentPage, pageSize, activeFilterCount, sortOrder]);

  // Dynamic formatted events with timestamps reflecting the chosen time range
  const formattedPaginatedEvents = useMemo(() => {
    return paginatedEvents.map((evt, idx) => {
      let ts = evt.timestamp;
      if (activeDateRange === 'Last 24 Hours') {
        const hoursAgo = [12, 24, 55, 95, 140, 210, 290, 360][idx % 8] || (idx + 1) * 35;
        const mins = hoursAgo % 60;
        const hrs = Math.floor(hoursAgo / 60);
        ts = hrs === 0 ? `${mins}m ago` : `Today, ${String(23 - hrs).padStart(2, '0')}:${String(59 - mins).padStart(2, '0')}`;
      } else if (activeDateRange === 'Last 30 Days') {
        const days = ['12 Jan', '08 Jan', '02 Jan', '27 Dec', '21 Dec', '14 Dec', '08 Dec', '02 Dec'];
        ts = `${days[idx % days.length]} ${evt.timestamp.slice(-8)}`;
      } else if (activeDateRange === 'This Month') {
        const days = ['12 Jan', '10 Jan', '08 Jan', '06 Jan', '04 Jan', '03 Jan', '02 Jan', '01 Jan'];
        ts = `${days[idx % days.length]} ${evt.timestamp.slice(-8)}`;
      }
      return { ...evt, timestamp: ts };
    });
  }, [paginatedEvents, activeDateRange]);

  // Total count display dynamically adapted to the active date range
  const displayTotalCount = useMemo(() => {
    if (activeFilterCount === 0) {
      return currentRangeData.totalEvents.value;
    }
    const ratio = sortedEvents.length / ALL_EVENTS.length;
    return Math.max(sortedEvents.length, Math.round(ratio * currentRangeData.totalEvents.value));
  }, [activeFilterCount, sortedEvents.length, currentRangeData.totalEvents.value]);

  // Export handling
  const handleExport = (format: 'csv' | 'json') => {
    const dataToExport = sortedEvents;
    if (format === 'json') {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentshield_events_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = [
        'Timestamp',
        'Event ID',
        'Agent',
        'Tool',
        'Decision',
        'Risk Score',
        'Execution',
        'Policy',
      ];
      const rows = dataToExport.map((e) => [
        `"${e.timestamp}"`,
        `"${e.id}"`,
        `"${e.agent}"`,
        `"${e.tool}"`,
        `"${e.decision}"`,
        e.riskScore,
        `"${e.execution}"`,
        `"${e.policy}"`,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agentshield_events_${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
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
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
        {/* LEFT WORKSPACE — expands to full width when the event panel is closed */}
        <div
          className={`min-w-0 transition-all duration-300 ${
            selectedEvent ? 'lg:col-span-7 xl:col-span-8' : 'lg:col-span-12'
          }`}
        >
          {/* 1. EVENTS PAGE HEADER */}
          <EventsPageHeader
            onRefresh={handleRefresh}
            isRefreshing={localRefreshing || isRefreshingGlobal}
            onExport={handleExport}
            dateRange={activeDateRange}
            onDateRangeChange={handleDateRangeChange}
          />

          {/* 2. KPI CARDS SECTION */}
          <EventsKpiSection kpiData={currentRangeData} />

          {/* 3. FILTER AND SEARCH TOOLBAR */}
          <EventsFilterToolbar
            filters={filters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearAll}
            activeFilterCount={activeFilterCount}
          />

          {/* 4. EVENTS TABLE & PAGINATION */}
          <EventsTable
            events={formattedPaginatedEvents}
            totalCount={displayTotalCount}
            currentPage={currentPage}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setCurrentPage(1);
            }}
            onSelectEvent={handleSelectEvent}
            onFilterByAgent={(ag) => handleFilterChange('agent', ag)}
            onFilterByTool={(tl) => handleFilterChange('tool', tl)}
            sortOrder={sortOrder}
            onToggleSort={() =>
              setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))
            }
          />
        </div>

        {/* RIGHT WORKSPACE — slide-in detail panel */}
        {selectedEvent && (
          <div
            className={`lg:col-span-5 xl:col-span-4 min-w-0 transition-all duration-200 ${

              isDrawerClosing
                ? 'opacity-0 translate-x-4 pointer-events-none'
                : 'opacity-100 translate-x-0'
            }`}
          >
            <EventDrawer
              event={selectedEvent}
              onClose={handleCloseDrawer}
              variant="panel"
            />
          </div>
        )}
      </div>
    </main>
  );
};
