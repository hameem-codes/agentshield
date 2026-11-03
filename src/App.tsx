import { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNavigation } from './components/TopNavigation';
import { DashboardHeader } from './components/DashboardHeader';
import { KpiSection } from './components/KpiSection';
import { SecurityActivityChart } from './components/SecurityActivityChart';
import { DecisionDistribution } from './components/DecisionDistribution';
import { RiskOverview } from './components/RiskOverview';
import { ActiveAgentsTable } from './components/ActiveAgentsTable';
import { AttentionRequired } from './components/AttentionRequired';
import { RecentEventsList } from './components/RecentEventsList';
import { PixelAlertToast } from './components/PixelAlertToast';
import { CommandPalette } from './components/CommandPalette';
import { AgentDetailModal, EventDetailModal } from './components/Modals';
import { EventsView } from './components/events/EventsView';
import { ReviewView } from './components/review/ReviewView';
import { PoliciesView } from './components/policies/PoliciesView';
import { BenchmarksView } from './components/benchmarks/BenchmarksView';
import { DASHBOARD_TIME_RANGES, type TimeRangeKey } from './data/dashboardTimeRanges';
import type { Agent, SecurityEvent, AttentionItem, AlertNotification } from './types';

export function App() {
  const getInitialTab = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        if (tabParam.toLowerCase() === 'overview') return 'Overview';
        if (tabParam.toLowerCase() === 'events') return 'Events';
        if (tabParam.toLowerCase() === 'review') return 'Review';
        if (tabParam.toLowerCase() === 'policies') return 'Policies';
        if (tabParam.toLowerCase() === 'benchmarks') return 'Benchmarks';
      }
      const hash = window.location.hash.replace('#', '').toLowerCase();
      if (hash === 'overview') return 'Overview';
      if (hash === 'events') return 'Events';
      if (hash === 'review') return 'Review';
      if (hash === 'policies') return 'Policies';
      if (hash === 'benchmarks') return 'Benchmarks';
    }
    return 'Overview'; // Default to Overview tab when opening the website
  };

  const [currentTab, setCurrentTab] = useState(getInitialTab);
  const [policiesSubTab, setPoliciesSubTab] = useState<'Policies' | 'Agents'>('Policies');
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangeKey>('Last 7 Days');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const currentRangeData = DASHBOARD_TIME_RANGES[selectedTimeRange] || DASHBOARD_TIME_RANGES['Last 7 Days'];

  const handleSelectTab = (tab: string) => {
    setCurrentTab(tab);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab.toLowerCase());
      window.history.replaceState(null, '', url.toString());
    }
  };

  // Selected modals
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);

  // Active Alert Notification (defaults to null on initial load to match Reference A)
  const [activeAlert, setActiveAlert] = useState<AlertNotification | null>(null);

  // Global CMD + K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setActiveAlert({
        id: `alert-${Date.now()}`,
        agent: 'Email-Agent',
        reason: 'Outbound volume threshold exceeded under Restricted v1 policy.',
        riskScore: 68,
        severity: 'warning',
        timestamp: 'Just now',
      });
    }, 800);
  };

  const handleAttentionSelect = (item: AttentionItem) => {
    if (item.id === 'paused-agent') {
      setSelectedAgent({
        id: 'Email-Agent',
        name: 'Email-Agent',
        status: 'Paused',
        policy: 'Restricted v1',
        events7d: 421,
        blockedCount: 53,
        blockedRate: '12.6%',
        runtime: 'Python Autogen v0.4',
        lastActive: '34m Ago',
        description: 'Outbound dispatch agent paused due to high risk score anomaly.',
      });
    } else if (item.id === 'review-actions') {
      handleSelectTab('Review');
    } else if (item.id === 'policy-changes') {
      setPoliciesSubTab('Policies');
      handleSelectTab('Policies');
    } else {
      setSelectedEvent({
        id: `attn-${item.id}`,
        agent: 'Ops-Agent',
        action: item.text,
        decision: item.severity === 'red' ? 'Blocked' : 'Review',
        riskScore: item.severity === 'red' ? 87 : 68,
        timestamp: 'Recently',
        reason: item.details,
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0d21] text-[#e2e1f0] flex">
      {/* 1. LEFT COLLAPSIBLE SIDEBAR */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* 2. MAIN VIEW CONTAINER (Dynamic offset matching sidebar collapsed/expanded state) */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${
          isSidebarCollapsed ? 'lg:pl-[72px]' : 'lg:pl-[272px]'
        }`}
      >
        {/* Top Navigation */}
        <TopNavigation
          title={currentTab === 'Policies' ? 'Policies & Agents' : currentTab}
          onOpenSearch={() => setIsSearchOpen(true)}
          onToggleMobileMenu={() => setIsMobileMenuOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />

        {/* Tab Body View */}
        {currentTab === 'Benchmarks' ? (
          <BenchmarksView />
        ) : currentTab === 'Policies' ? (
          <PoliciesView
            initialSubTab={policiesSubTab}
            onSelectSubTab={setPoliciesSubTab}
            selectedTimeRange={selectedTimeRange}
          />
        ) : currentTab === 'Review' ? (
          <ReviewView
            onRefreshGlobal={handleRefresh}
            isRefreshingGlobal={isRefreshing}
            selectedTimeRange={selectedTimeRange}
            onSelectTimeRange={setSelectedTimeRange}
          />
        ) : currentTab === 'Events' ? (
          <EventsView
            onRefreshGlobal={handleRefresh}
            isRefreshingGlobal={isRefreshing}
            selectedTimeRange={selectedTimeRange}
            onSelectTimeRange={setSelectedTimeRange}
          />
        ) : (
          <main className="flex-1 px-5 py-2.5 md:px-6 md:py-3 max-w-[1536px] w-full mx-auto flex flex-col gap-3">
            {/* Header Section: Greeting + Pixel Backdrop + Actions */}
            <DashboardHeader
              onRefresh={handleRefresh}
              isRefreshing={isRefreshing}
              selectedRange={selectedTimeRange}
              onSelectRange={setSelectedTimeRange}
            />

            {/* KPI Section: 4 Metric Cards with Sparklines */}
            <KpiSection data={currentRangeData} />

            {/* Middle Analytics Grid: 3 Panels */}
            {/* Security Activity (approx 48%), Decision Distribution (26%), Risk Overview (26%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
              <div className="lg:col-span-6 xl:col-span-6 flex flex-col">
                <SecurityActivityChart chartData={currentRangeData.chart} />
              </div>
              <div className="lg:col-span-3 xl:col-span-3 flex flex-col">
                <DecisionDistribution distributionData={currentRangeData.distribution} />
              </div>
              <div className="lg:col-span-3 xl:col-span-3 flex flex-col">
                <RiskOverview riskData={currentRangeData.risk} />
              </div>
            </div>

            {/* Bottom Grid: 3 Panels */}
            {/* Active Agents (approx 48%), Attention Required (26%), Recent Events (26%) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch">
              <div className="lg:col-span-6 xl:col-span-6 flex flex-col">
                <ActiveAgentsTable
                  onSelectAgent={setSelectedAgent}
                  onViewAll={() => {
                    setPoliciesSubTab('Agents');
                    handleSelectTab('Policies');
                  }}
                  agentsData={currentRangeData.agents}
                />
              </div>
              <div className="lg:col-span-3 xl:col-span-3 flex flex-col">
                <AttentionRequired
                  onSelectItem={handleAttentionSelect}
                  attentionData={currentRangeData.attention}
                />
              </div>
              <div className="lg:col-span-3 xl:col-span-3 flex flex-col">
                <RecentEventsList
                  onSelectEvent={setSelectedEvent}
                  onViewAll={() => {
                    handleSelectTab('Events');
                  }}
                  eventsData={currentRangeData.recentEvents}
                />
              </div>
            </div>
          </main>
        )}
      </div>

      {/* 3. INTERACTIVE PIXEL ALERT TOAST */}
      <PixelAlertToast
        alert={activeAlert}
        onDismiss={() => setActiveAlert(null)}
        onViewEvent={(alert) => {
          setSelectedEvent({
            id: alert.id,
            agent: alert.agent,
            action: 'Anomaly_Investigation',
            decision: alert.severity === 'critical' ? 'Blocked' : 'Review',
            riskScore: alert.riskScore,
            timestamp: alert.timestamp,
            reason: alert.reason,
            payloadSummary: `Payload inspection flagged for ${alert.agent}.\nAnomaly pattern detected in outbound packets.`,
          });
          setActiveAlert(null);
        }}
      />

      {/* 4. COMMAND PALETTE (CMD + K) */}
      <CommandPalette
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectAction={(actionName) => {
          console.log('Action selected:', actionName);
        }}
      />

      {/* 5. AGENT DETAIL MODAL */}
      <AgentDetailModal
        agent={selectedAgent}
        onClose={() => setSelectedAgent(null)}
      />

      {/* 6. EVENT DETAIL MODAL */}
      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}

export default App;
