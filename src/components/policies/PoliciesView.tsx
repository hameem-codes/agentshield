import React, { useState, useMemo, useEffect, useRef } from 'react';
import { PolicyPageHeader } from './PolicyPageHeader';
import { PolicyKpiSection } from './PolicyKpiSection';
import { PolicyToolbar } from './PolicyToolbar';
import { PolicyTable } from './PolicyTable';
import { PolicyDetailPanel } from './PolicyDetailPanel';
import { PolicyModal } from './PolicyModal';
import { AgentsTableView } from './AgentsTableView';
import { INITIAL_POLICIES } from './policyData';
import type { SecurityPolicy, PolicyFilterState } from './policyTypes';

export const PoliciesView: React.FC = () => {
  const [policies, setPolicies] = useState<SecurityPolicy[]>(INITIAL_POLICIES);
  // Starts closed so the policy portal only appears on demand
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null);
  const [isDetailClosing, setIsDetailClosing] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  const [activeMainTab, setActiveMainTab] = useState<'Policies' | 'Agents'>('Policies');

  // Filters
  const [filters, setFilters] = useState<PolicyFilterState>({
    searchQuery: '',
    status: 'All',
    assignedAgent: 'All',
  });

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [policyToEdit, setPolicyToEdit] = useState<SecurityPolicy | null>(null);

  // Mobile detail drawer
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);

  // Notification toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
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

  // Open (or swap) the policy portal with an enter animation
  const handleSelectPolicy = (pol: SecurityPolicy) => {
    cancelCloseTimer();
    setIsDetailClosing(false);
    setSelectedPolicy(pol);
    setIsMobileDetailOpen(true);
  };

  // Play the exit animation, then unmount the portal
  const handleCloseDetails = () => {
    cancelCloseTimer();
    setIsDetailClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedPolicy(null);
      setIsDetailClosing(false);
      setIsMobileDetailOpen(false);
      closeTimerRef.current = null;
    }, 220);
  };

  const handleFilterChange = <K extends keyof PolicyFilterState>(
    key: K,
    value: PolicyFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      status: 'All',
      assignedAgent: 'All',
    });
  };

  // Filtered policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((pol) => {
      // 1. Search Query
      if (filters.searchQuery.trim()) {
        const q = filters.searchQuery.toLowerCase();
        const matchesName = pol.name.toLowerCase().includes(q);
        const matchesDesc = pol.description.toLowerCase().includes(q);
        const matchesVer = pol.version.toLowerCase().includes(q);
        const matchesAgent = pol.assignedAgentNames.some((ag) =>
          ag.toLowerCase().includes(q)
        );
        if (!matchesName && !matchesDesc && !matchesVer && !matchesAgent) {
          return false;
        }
      }

      // 2. Status
      if (filters.status !== 'All' && pol.status !== filters.status) {
        return false;
      }

      // 3. Assigned Agent
      if (
        filters.assignedAgent !== 'All' &&
        !pol.assignedAgentNames.includes(filters.assignedAgent)
      ) {
        return false;
      }

      return true;
    });
  }, [policies, filters]);

  // Counts for KPI section
  const counts = useMemo(() => {
    let active = 0;
    let draft = 0;
    let archived = 0;
    policies.forEach((p) => {
      if (p.status === 'Active') active++;
      else if (p.status === 'Draft') draft++;
      else if (p.status === 'Archived') archived++;
    });
    return {
      total: policies.length,
      active,
      draft,
      archived,
    };
  }, [policies]);

  // Save (Create or Edit)
  const handleSavePolicy = (data: Partial<SecurityPolicy>) => {
    cancelCloseTimer();
    setIsDetailClosing(false);

    if (policyToEdit) {
      // Edit existing
      setPolicies((prev) =>
        prev.map((p) => {
          if (p.id === policyToEdit.id) {
            const updated: SecurityPolicy = {
              ...p,
              ...data,
              lastUpdated: 'Just now',
              lastUpdatedTimestamp: Date.now(),
            } as SecurityPolicy;
            setSelectedPolicy(updated);
            return updated;
          }
          return p;
        })
      );
      showToast(`Policy "${data.name}" updated successfully.`);
    } else {
      // Create new
      const newPolicy: SecurityPolicy = {
        id: data.id || `pol-${Date.now()}`,
        name: data.name || 'New Policy',
        version: data.version || 'v1.0.0',
        status: data.status || 'Active',
        description: data.description || 'Custom security policy ruleset',
        assignedAgentNames: [],
        lastUpdated: 'Just now',
        lastUpdatedTimestamp: Date.now(),
        rules: data.rules || {
          allowedTools: ['read_web'],
          argumentLimits: { maxItemsPerRequest: 10, maxFileSize: '25 MB' },
          allowedHostnames: ['*.internal.com'],
          defaultDeny: true,
          reviewThreshold: 60,
          auditAllActions: true,
        },
        versions: [
          {
            version: data.version || 'v1.0.0',
            date: 'Today',
            author: 'Admin',
            description: 'Initial policy creation',
            isCurrent: true,
          },
        ],
        agents: [],
      };
      setPolicies((prev) => [newPolicy, ...prev]);
      setSelectedPolicy(newPolicy);
      showToast(`Policy "${newPolicy.name}" created successfully.`);
    }
  };

  return (
    <main className="flex-1 px-5 py-3 md:px-6 md:py-3.5 max-w-[1536px] w-full mx-auto flex flex-col justify-between">
      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 px-4 py-2.5 rounded-xl bg-[#221c45] border border-[#6d3ee8] text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <span className="w-2 h-2 rounded-full bg-[#22c55e] animate-ping" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. PAGE HEADER */}
      <PolicyPageHeader
        activeMainTab={activeMainTab}
        onSelectMainTab={(tab) => {
          setActiveMainTab(tab);
          // Leaving the Policies tab closes any open policy portal
          if (tab === 'Agents') {
            cancelCloseTimer();
            setSelectedPolicy(null);
            setIsDetailClosing(false);
            setIsMobileDetailOpen(false);
          }
        }}
      />

      {/* 2. BODY CONTENT */}
      {activeMainTab === 'Policies' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start mt-1">
          {/* LEFT COLUMN: KPIS + TOOLBAR + TABLE — expands when the portal is closed */}
          <div
            className={`min-w-0 flex flex-col transition-all duration-300 ${
              selectedPolicy ? 'lg:col-span-8' : 'lg:col-span-12'
            }`}
          >
            {/* KPI CARDS */}
            <PolicyKpiSection
              totalCount={counts.total}
              activeCount={counts.active}
              draftCount={counts.draft}
              archivedCount={counts.archived}
            />

            {/* TOOLBAR */}
            <PolicyToolbar
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              onOpenNewPolicy={() => {
                setPolicyToEdit(null);
                setIsModalOpen(true);
              }}
            />

            {/* POLICIES TABLE */}
            <PolicyTable
              policies={filteredPolicies}
              selectedPolicy={selectedPolicy}
              onSelectPolicy={handleSelectPolicy}
              onEditPolicy={(pol) => {
                setPolicyToEdit(pol);
                setIsModalOpen(true);
              }}
            />
          </div>

          {/* RIGHT COLUMN: ANIMATED POLICY DETAIL PORTAL (4 OF 12 COLS) */}
          {selectedPolicy && (
            <div
              key={selectedPolicy.id}
              className={`hidden lg:block lg:col-span-4 sticky top-[76px] ${
                isDetailClosing ? 'portal-shell-exit' : 'portal-shell-enter'
              }`}
            >
              <PolicyDetailPanel
                policy={selectedPolicy}
                onClose={handleCloseDetails}
                onEditPolicy={(pol) => {
                  setPolicyToEdit(pol);
                  setIsModalOpen(true);
                }}
              />
            </div>
          )}
        </div>
      ) : (
        /* AGENTS TAB VIEW */
        <div className="mt-2">
          <AgentsTableView
            onSelectPolicyByName={(pName) => {
              const matched = policies.find((p) => p.name === pName);
              if (matched) {
                handleSelectPolicy(matched);
                setActiveMainTab('Policies');
              }
            }}
          />
        </div>
      )}

      {/* MOBILE DETAIL DRAWER */}
      {isMobileDetailOpen && (
        <div
          className={`fixed inset-0 z-50 lg:hidden flex justify-end bg-black/60 backdrop-blur-xs ${
            isDetailClosing ? 'portal-backdrop-exit' : 'portal-backdrop-enter'
          }`}
        >
          <div
            className="fixed inset-0"
            onClick={handleCloseDetails}
          />
          <div
            className={`relative w-full max-w-md h-full z-10 ${
              isDetailClosing ? 'portal-drawer-exit' : 'portal-drawer-enter'
            }`}
          >
            <PolicyDetailPanel
              policy={selectedPolicy}
              onClose={handleCloseDetails}
              onEditPolicy={(pol) => {
                setPolicyToEdit(pol);
                setIsModalOpen(true);
                handleCloseDetails();
              }}
            />
          </div>
        </div>
      )}

      {/* POLICY CREATE/EDIT MODAL */}
      <PolicyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        policyToEdit={policyToEdit}
        onSavePolicy={handleSavePolicy}
      />
    </main>
  );
};
