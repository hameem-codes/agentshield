import React, { useState, useEffect } from "react";
import { WindingPath } from "./components/WindingPath";
import type { PathStop } from "./components/WindingPath";
import { api } from "./api/client";
import type { ApiEventItem } from "./api/client";
import {
  DEMO_STATS,
  DEMO_SECURITY_EVENTS,
  DEMO_POLICIES,
  DEMO_RISK_FACTORS,
} from "./mock/events";

const PIPELINE_STOPS: PathStop[] = [
  { id: 1, label: "Propose", description: "Agent proposes tool action" },
  { id: 2, label: "Validate", description: "Dataclass schema verification" },
  { id: 3, label: "Risk", description: "Standalone deterministic RiskEngine" },
  { id: 4, label: "Policy", description: "Fails closed, unknown tool => BLOCK" },
  { id: 5, label: "Decision", description: "ALLOW / REVIEW / BLOCK" },
  { id: 6, label: "Execute", description: "Tool callable invoked exactly once on ALLOW" },
  { id: 7, label: "Audit", description: "Separate decision vs execution logging" },
];

export const App: React.FC = () => {
  const [selectedStopIndex, setSelectedStopIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<"all" | "BLOCK" | "REVIEW" | "ALLOW">("all");

  // API State
  const [isApiOnline, setIsApiOnline] = useState<boolean | null>(null);
  const [apiEvents, setApiEvents] = useState<ApiEventItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;

    async function checkApiAndFetchEvents() {
      try {
        setIsLoading(true);
        await api.getHealth();
        if (!isMounted) return;
        setIsApiOnline(true);

        const eventsRes = await api.getEvents(50);
        if (!isMounted) return;
        setApiEvents(eventsRes.events);
      } catch {
        if (!isMounted) return;
        setIsApiOnline(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    checkApiAndFetchEvents();
    const interval = setInterval(checkApiAndFetchEvents, 5000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Compute stats: if API online, compute from real events; if offline, use mock with demo tag
  const stats = isApiOnline
    ? {
        allow: apiEvents.filter((e) => e.decision === "ALLOW").length,
        review: apiEvents.filter((e) => e.decision === "REVIEW").length,
        block: apiEvents.filter((e) => e.decision === "BLOCK").length,
        total: apiEvents.length,
        isLive: true,
      }
    : {
        allow: DEMO_STATS.allowCount,
        review: DEMO_STATS.reviewCount,
        block: DEMO_STATS.blockCount,
        total: DEMO_STATS.totalEvaluated,
        isLive: false,
      };

  // Events list: live if online, mock if offline
  const displayedEvents = isApiOnline
    ? (activeTab === "all" ? apiEvents : apiEvents.filter((e) => e.decision === activeTab))
    : (activeTab === "all" ? DEMO_SECURITY_EVENTS : DEMO_SECURITY_EVENTS.filter((e) => e.decision === activeTab));

  const selectedStop = PIPELINE_STOPS[selectedStopIndex];

  return (
    <div className="min-h-screen text-[#f4ecd0] relative selection:bg-[#ff8fb1] selection:text-[#17150d] pb-24">
      {/* Top Header */}
      <header className="px-8 pt-8 pb-4 flex flex-col md:flex-row md:items-baseline justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="font-['Archivo'] font-[900] italic text-4xl sm:text-5xl tracking-tight text-[#f4ecd0]">
              AGENTSHIELD
            </h1>
            <span className="text-xs font-['Archivo'] uppercase tracking-widest text-[#ff8fb1] font-extrabold">
              RUNTIME SECURITY
            </span>
            {isApiOnline ? (
              <span className="text-[10px] font-mono uppercase bg-[#17150d] text-[#3ddc97] px-1.5 py-0.5 border border-[#3ddc97]/40 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#3ddc97] animate-pulse"></span>
                [live] API online
              </span>
            ) : (
              <span className="text-[10px] font-mono uppercase bg-[#17150d] text-[#ff8fb1] px-1.5 py-0.5 border border-[#ff8fb1]/40 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff8fb1]"></span>
                API offline [demo data]
              </span>
            )}
          </div>
          <p className="text-sm text-[#f4ecd0]/70 mt-1 max-w-xl font-['DM_Sans']">
            Deterministic runtime authorization layer for tool-using AI agents. Propose → Validate → Risk → Policy → Decision → Execute → Audit.
          </p>
        </div>

        {/* Selected stop detail as plain text sitting on the grid */}
        <div className="text-left md:text-right max-w-sm">
          <div className="text-xs font-['Archivo'] uppercase font-[900] italic text-[#ff8fb1] tracking-wider">
            STAGE {selectedStop.id} / 7 — {selectedStop.label}
          </div>
          <p className="text-xs text-[#f4ecd0]/80 mt-1 font-['DM_Sans']">
            {selectedStop.description}
          </p>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-8 mt-4 relative">
        {/* Chips row sitting directly on the grid */}
        <div className="mb-6 flex flex-wrap items-center gap-4">
          {/* Section Heading: Overview */}
          <div className="mr-4">
            <h2 className="font-['Archivo'] font-[900] italic text-2xl uppercase tracking-wider text-[#ff8fb1] flex items-center gap-2">
              OVERVIEW
              {stats.isLive ? (
                <span className="text-[10px] font-mono not-italic px-1.5 py-0.5 bg-[#17150d] text-[#3ddc97] border border-[#3ddc97]/40">
                  live
                </span>
              ) : (
                <span className="text-[10px] font-mono not-italic px-1.5 py-0.5 bg-[#17150d] text-[#ff8fb1] border border-[#ff8fb1]/40">
                  demo
                </span>
              )}
            </h2>
            <p className="text-xs text-[#f4ecd0]/70 font-['DM_Sans']">
              Evaluated tool proposals
            </p>
          </div>

          {/* ALLOW Chip */}
          <div
            className="flex items-center gap-3 px-5 py-2.5 bg-[#3ddc97] text-[#17150d] border-[3px] border-black"
            style={{ boxShadow: "4px 4px 0px #000000" }}
          >
            <span className="font-['Archivo'] font-[900] italic tracking-wider text-sm">
              ALLOW
            </span>
            <span className="font-['Archivo'] font-[900] text-3xl leading-none">
              {stats.allow}
            </span>
          </div>

          {/* REVIEW Chip */}
          <div
            className="flex items-center gap-3 px-5 py-2.5 bg-[#f3b82b] text-[#17150d] border-[3px] border-black"
            style={{ boxShadow: "4px 4px 0px #000000" }}
          >
            <span className="font-['Archivo'] font-[900] italic tracking-wider text-sm">
              REVIEW
            </span>
            <span className="font-['Archivo'] font-[900] text-3xl leading-none">
              {stats.review}
            </span>
          </div>

          {/* BLOCK Chip */}
          <div
            className="flex items-center gap-3 px-5 py-2.5 bg-[#ff8fb1] text-[#17150d] border-[3px] border-black"
            style={{ boxShadow: "4px 4px 0px #000000" }}
          >
            <span className="font-['Archivo'] font-[900] italic tracking-wider text-sm">
              BLOCK
            </span>
            <span className="font-['Archivo'] font-[900] text-3xl leading-none">
              {stats.block}
            </span>
          </div>
        </div>

        {/* Winding Path Canvas with Section Text Sitting Unevenly Around the Curve */}
        <div className="relative w-full max-w-[1240px] mx-auto">
          {/* Reusable WindingPath SVG */}
          <WindingPath
            stops={PIPELINE_STOPS}
            activeStopIndex={selectedStopIndex}
            onSelectStop={(_, idx) => setSelectedStopIndex(idx)}
          />

          {/* Unevenly Positioned Plain Text Blocks Around the SVG Path */}

          {/* Block A: Policies (top-left offset) */}
          <div className="md:absolute top-[3%] left-[2%] max-w-[280px] pointer-events-auto my-4 md:my-0">
            <h3 className="font-['Archivo'] font-[900] italic text-xl uppercase tracking-wider text-[#ff8fb1] flex items-center gap-2">
              POLICIES
              <span className="text-[9px] font-mono not-italic px-1 py-0.2 bg-[#17150d] text-[#ff8fb1] border border-[#ff8fb1]/40">
                demo
              </span>
            </h3>
            <p className="text-xs text-[#f4ecd0]/80 mt-1 leading-relaxed font-['DM_Sans']">
              Deterministic rules declared in PolicyConfiguration. Source of truth is PolicyEngine.known_tools. Unknown tools fail closed immediately.
            </p>
            <div className="mt-2 space-y-1.5 text-[11px] text-[#f4ecd0]/70 font-mono">
              {DEMO_POLICIES.slice(0, 2).map((p, idx) => (
                <div key={idx} className="border-l-2 border-[#ff8fb1] pl-2">
                  <span className="font-bold text-[#f4ecd0]">{p.name}:</span> {p.description}
                </div>
              ))}
            </div>
          </div>

          {/* Block B: Risk (top-right offset) */}
          <div className="md:absolute top-[2%] right-[4%] max-w-[270px] pointer-events-auto text-left md:text-right my-4 md:my-0">
            <h3 className="font-['Archivo'] font-[900] italic text-xl uppercase tracking-wider text-[#ff8fb1] flex items-center md:justify-end gap-2">
              <span className="text-[9px] font-mono not-italic px-1 py-0.2 bg-[#17150d] text-[#ff8fb1] border border-[#ff8fb1]/40">
                demo
              </span>
              RISK
            </h3>
            <p className="text-xs text-[#f4ecd0]/80 mt-1 leading-relaxed font-['DM_Sans']">
              Standalone deterministic scoring (0-100). Same input gives same score. Risk can elevate to REVIEW or BLOCK, never override a policy denial.
            </p>
            <div className="mt-2 space-y-1 text-[11px] text-[#f4ecd0]/70 font-mono">
              {DEMO_RISK_FACTORS.slice(0, 3).map((rf) => (
                <div key={rf.id} className="border-l-2 md:border-l-0 md:border-r-2 border-[#ff8fb1] pl-2 md:pl-0 md:pr-2">
                  <span className="text-[#f4ecd0]">{rf.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Block C: Attack Simulator (mid-left offset) */}
          <div className="md:absolute top-[48%] left-[1%] max-w-[260px] pointer-events-auto my-4 md:my-0">
            <h3 className="font-['Archivo'] font-[900] italic text-xl uppercase tracking-wider text-[#ff8fb1] flex items-center gap-2">
              ATTACK SIMULATOR
              <span className="text-[9px] font-mono not-italic px-1 py-0.2 bg-[#17150d] text-[#3ddc97] border border-[#3ddc97]/40">
                live
              </span>
            </h3>
            <p className="text-xs text-[#f4ecd0]/70 mt-1 leading-relaxed font-['DM_Sans']">
              No active simulation running. Synthetic red-team injection tests and tool fuzzing will appear here once executed.
            </p>
          </div>

          {/* Block D: Benchmarks (mid-right offset) */}
          <div className="md:absolute top-[45%] right-[2%] max-w-[250px] pointer-events-auto text-left md:text-right my-4 md:my-0">
            <h3 className="font-['Archivo'] font-[900] italic text-xl uppercase tracking-wider text-[#ff8fb1] flex items-center md:justify-end gap-2">
              <span className="text-[9px] font-mono not-italic px-1 py-0.2 bg-[#17150d] text-[#3ddc97] border border-[#3ddc97]/40">
                live
              </span>
              BENCHMARKS
            </h3>
            <p className="text-xs text-[#f4ecd0]/70 mt-1 leading-relaxed font-['DM_Sans']">
              No benchmark runs recorded. Execution latency overhead and throughput metrics will stream here.
            </p>
          </div>

          {/* Block E: The ONE small "window" for Security Events list (bottom-center / bottom-left) */}
          <div className="mt-8 max-w-xl mx-auto md:mx-0 md:ml-12">
            <div className="mb-2 flex items-baseline justify-between flex-wrap gap-2">
              <h3 className="font-['Archivo'] font-[900] italic text-xl uppercase tracking-wider text-[#ff8fb1] flex items-center gap-2">
                SECURITY EVENTS
                {isApiOnline ? (
                  <span className="text-[9px] font-mono not-italic px-1 py-0.2 bg-[#17150d] text-[#3ddc97] border border-[#3ddc97]/40">
                    live stream
                  </span>
                ) : (
                  <span className="text-[9px] font-mono not-italic px-1 py-0.2 bg-[#17150d] text-[#ff8fb1] border border-[#ff8fb1]/40">
                    demo data
                  </span>
                )}
              </h3>
              <div className="flex gap-2 text-xs font-['Archivo'] font-[900] italic">
                {(["all", "BLOCK", "REVIEW", "ALLOW"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`cursor-pointer px-2 py-0.5 transition-colors ${
                      activeTab === tab
                        ? "text-[#17150d] bg-[#f4ecd0]"
                        : "text-[#f4ecd0]/60 hover:text-[#f4ecd0]"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* The single small "window" for events list (bordered box + background) */}
            <div
              className="bg-[#17150d] border-[3px] border-black rounded-lg p-3 max-h-[300px] overflow-y-auto text-xs font-mono"
              style={{ boxShadow: "4px 4px 0px #000000" }}
            >
              {/* Window title bar */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#f4ecd0]/20 text-[11px] text-[#f4ecd0]/60 font-['DM_Sans']">
                <span>events_stream.log</span>
                <span>
                  {isApiOnline
                    ? `${displayedEvents.length} items [live]`
                    : `${displayedEvents.length} items [demo]`}
                </span>
              </div>

              {isLoading && displayedEvents.length === 0 ? (
                <div className="py-6 text-center text-[#f4ecd0]/40 font-['DM_Sans']">
                  Loading events...
                </div>
              ) : displayedEvents.length === 0 ? (
                <div className="py-6 text-center text-[#f4ecd0]/40 font-['DM_Sans']">
                  No events recorded
                </div>
              ) : (
                <div className="space-y-2.5">
                  {displayedEvents.map((evt) => (
                    <div
                      key={evt.id}
                      className="p-2 border-l-2 border-[#ff8fb1] bg-[#0e0e0e]/80"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-['Archivo'] font-[900] italic text-[11px] px-1.5 py-0.2 ${
                              evt.decision === "ALLOW"
                                ? "bg-[#3ddc97] text-[#17150d]"
                                : evt.decision === "REVIEW"
                                ? "bg-[#f3b82b] text-[#17150d]"
                                : "bg-[#ff8fb1] text-[#17150d]"
                            }`}
                          >
                            {evt.decision}
                          </span>
                          <span className="text-[#f4ecd0] font-bold">{evt.agent}</span>
                          <span className="text-[#f4ecd0]/50">→</span>
                          <span className="text-[#ff8fb1]">{evt.tool}()</span>
                        </div>
                        <span className="text-[#f4ecd0]/40 text-[10px]">
                          {typeof evt.timestamp === "string" && evt.timestamp.includes("T")
                            ? evt.timestamp.split("T")[1].slice(0, 8)
                            : evt.timestamp}
                        </span>
                      </div>

                      <div className="text-[10px] text-[#f4ecd0]/70 mt-1 truncate">
                        args: {JSON.stringify(evt.arguments)}
                      </div>
                      <div className="text-[10px] text-[#f4ecd0]/50 mt-0.5">
                        {evt.reasons && evt.reasons.length > 0 ? evt.reasons[0] : ""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
