import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle } from 'lucide-react';
import { PixelPlayIcon } from '../pixel/PixelIcons';
import type { BenchmarkRunRecord } from './benchmarkTypes';
import { BENCHMARK_TEST_CASES_V1 } from './benchmarkData';

interface RunBenchmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCompleteRun: (newRun: BenchmarkRunRecord) => void;
}

export const RunBenchmarkModal: React.FC<RunBenchmarkModalProps> = ({
  isOpen,
  onClose,
  onCompleteRun,
}) => {
  const [selectedDataset, setSelectedDataset] = useState('v1.0 (32 cases)');
  const [selectedPolicy, setSelectedPolicy] = useState('Research v2.3.1');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedRun, setCompletedRun] = useState<BenchmarkRunRecord | null>(null);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleStart = () => {
    setIsRunning(true);
    setProgress(0);
    setCurrentStepIndex(0);
    setCompletedRun(null);

    const totalSteps = BENCHMARK_TEST_CASES_V1.length;
    let step = 0;

    timerRef.current = window.setInterval(() => {
      step++;
      setCurrentStepIndex(step);
      const currentPct = Math.min(100, Math.round((step / totalSteps) * 100));
      setProgress(currentPct);

      if (step >= totalSteps) {
        if (timerRef.current) window.clearInterval(timerRef.current);
        setIsRunning(false);

        // Generate run record
        const runId = `run_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}_0${Math.floor(Math.random() * 8) + 3}`;
        const newRecord: BenchmarkRunRecord = {
          id: runId,
          dataset: selectedDataset,
          policyVersion: selectedPolicy,
          total: 32,
          blocked: 14,
          fp: 2,
          bypasses: 0,
          status: 'Completed',
          timestamp: 'Just now',
          benignCases: 16,
          maliciousCases: 16,
          unauthorizedExecutionsBaseline: 14,
          unauthorizedExecutionsProtected: 0,
          blockedMaliciousBaseline: 0,
          blockedMaliciousProtected: 16,
          fpBaseline: 0,
          fpProtected: 2,
          benignAllowedBaseline: 16,
          benignAllowedProtected: 16,
          allowedCount: 16,
          allowedPercent: 50.0,
          reviewCount: 2,
          reviewPercent: 6.3,
          blockedCount: 14,
          blockedPercent: 43.7,
          categoryResults: [
            { category: 'Normal authorized actions', completed: 8, total: 8, ratio: '8/8', passRate: 100 },
            { category: 'Unknown tool invocation', completed: 4, total: 4, ratio: '4/4', passRate: 100 },
            { category: 'Quantity limit violations', completed: 4, total: 4, ratio: '4/4', passRate: 100 },
            { category: 'Unauthorized destinations', completed: 3, total: 4, ratio: '3/4', passRate: 75 },
            { category: 'Prompt injection attempts', completed: 4, total: 4, ratio: '4/4', passRate: 100 },
            { category: 'Invalid arguments', completed: 4, total: 4, ratio: '4/4', passRate: 100 },
          ],
        };
        setCompletedRun(newRecord);
      }
    }, 110);
  };

  const handleApply = () => {
    if (completedRun) {
      onCompleteRun(completedRun);
      onClose();
    }
  };

  const currentTestCase = BENCHMARK_TEST_CASES_V1[Math.min(currentStepIndex, BENCHMARK_TEST_CASES_V1.length - 1)];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-xl p-[2px] bg-[#3a3273] pixel-corners shadow-2xl">
        <div className="w-full bg-[#16142e] pixel-corners p-5 flex flex-col">
          {/* MODAL HEADER */}
          <div className="flex items-center justify-between pb-3.5 border-b border-[#292254]">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#6d3ee8] text-white">
                <PixelPlayIcon size={14} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Execute Security Benchmark
                </h3>
                <p className="text-xs text-[#9d97c7]">
                  Verify policy protection against adversarial agent actions.
                </p>
              </div>
            </div>

            {!isRunning && (
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg text-[#958fbe] hover:text-white hover:bg-[#25204c] flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* FORM / RUNNING CONTENT */}
          {!isRunning && !completedRun ? (
            <div className="py-4 space-y-4 text-xs">
              {/* Select Dataset */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9d97c7] mb-1.5">
                  Target Dataset
                </label>
                <select
                  value={selectedDataset}
                  onChange={(e) => setSelectedDataset(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121025] border border-[#3e3678] rounded-xl text-white font-medium focus:outline-none focus:border-[#7b4cf0]"
                >
                  <option value="v1.0 (32 cases)">v1.0 — Full Security Suite (32 cases)</option>
                  <option value="v0.9 (24 cases)">v0.9 — Core Regression Suite (24 cases)</option>
                  <option value="OWASP Suite (16 cases)">OWASP Agentic Attacks (16 cases)</option>
                </select>
              </div>

              {/* Select Policy */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#9d97c7] mb-1.5">
                  Enforced Policy & Version
                </label>
                <select
                  value={selectedPolicy}
                  onChange={(e) => setSelectedPolicy(e.target.value)}
                  className="w-full px-3 py-2 bg-[#121025] border border-[#3e3678] rounded-xl text-white font-medium focus:outline-none focus:border-[#7b4cf0]"
                >
                  <option value="Research v2.3.1">Research v2.3.1 (Active Standard)</option>
                  <option value="Operations v1.4.0">Operations v1.4.0 (DevOps Sandbox)</option>
                  <option value="Data Access v3.0.0">Data Access v3.0.0 (Enterprise Strict)</option>
                  <option value="Restricted v1.0.0">Restricted v1.0.0 (Max Containment)</option>
                </select>
              </div>

              {/* Benchmark Specs Note */}
              <div className="p-3 bg-[#131128] border border-[#2b2457] rounded-xl text-[#b0a9db] leading-relaxed">
                <span className="font-bold text-white">Execution Scope: </span>
                Tests 16 benign and 16 adversarial payloads across prompt injection, SSRF, tool misuse, and volume quotas.
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292254]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#1d1a3c] border border-[#372f6a] text-white text-xs font-semibold hover:bg-[#282452] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStart}
                  className="px-4 py-2 rounded-xl bg-[#6d3ee8] hover:bg-[#7b4cf0] text-white text-xs font-bold border border-[#9b73ff] shadow-[0_2px_10px_rgba(109,62,232,0.4)] flex items-center gap-2 cursor-pointer"
                >
                  <PixelPlayIcon size={12} />
                  <span>Start Benchmark Run</span>
                </button>
              </div>
            </div>
          ) : isRunning ? (
            /* LIVE EXECUTION PROGRESS */
            <div className="py-5 space-y-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-white font-bold flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-[#22c55e] animate-ping" />
                  Running Benchmark Suite...
                </span>
                <span className="font-mono font-bold text-[#c4bbf0]">
                  {progress}% ({currentStepIndex}/32)
                </span>
              </div>

              {/* Progress Track */}
              <div className="w-full h-3 rounded-md bg-[#100e24] overflow-hidden p-0.5 border border-[#322a61]">
                <div
                  className="h-full bg-gradient-to-r from-[#6d3ee8] to-[#22c55e] rounded-sm transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Live Step Card */}
              {currentTestCase && (
                <div className="p-3.5 bg-[#121026] border border-[#2e265c] rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] font-bold text-[#9d97c7]">
                      {currentTestCase.id} • {currentTestCase.category}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      currentTestCase.type === 'Benign' ? 'bg-[#15803d]/30 text-[#4ade80]' : 'bg-[#b91c1c]/30 text-[#f87171]'
                    }`}>
                      {currentTestCase.type}
                    </span>
                  </div>
                  <div className="text-xs text-white font-medium truncate">
                    {currentTestCase.description}
                  </div>
                  <div className="font-mono text-[10px] text-[#8e87be] truncate">
                    Payload: {currentTestCase.payloadSummary}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* COMPLETED RUN SUMMARY */
            <div className="py-4 space-y-4 text-xs">
              <div className="p-4 bg-[#142e20] border border-[#22c55e]/50 rounded-xl flex items-center gap-3">
                <CheckCircle size={28} className="text-[#22c55e] flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">
                    Benchmark Completed Successfully!
                  </div>
                  <div className="text-xs text-[#a7f3d0] mt-0.5">
                    Evaluated 32 cases under {completedRun?.policyVersion}. Zero bypasses detected.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="p-2.5 bg-[#171433] border border-[#2e2659] rounded-lg">
                  <div className="text-lg font-bold font-mono text-white">32</div>
                  <div className="text-[10px] text-[#9d97c7]">Total Tests</div>
                </div>
                <div className="p-2.5 bg-[#171433] border border-[#2e2659] rounded-lg">
                  <div className="text-lg font-bold font-mono text-[#f87171]">14</div>
                  <div className="text-[10px] text-[#9d97c7]">Blocked</div>
                </div>
                <div className="p-2.5 bg-[#171433] border border-[#2e2659] rounded-lg">
                  <div className="text-lg font-bold font-mono text-[#fde047]">2</div>
                  <div className="text-[10px] text-[#9d97c7]">False Positives</div>
                </div>
                <div className="p-2.5 bg-[#171433] border border-[#2e2659] rounded-lg">
                  <div className="text-lg font-bold font-mono text-[#4ade80]">0</div>
                  <div className="text-[10px] text-[#9d97c7]">Bypasses</div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#292254]">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-[#1d1a3c] border border-[#372f6a] text-white text-xs font-semibold hover:bg-[#282452] cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="px-4 py-2 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-white text-xs font-bold shadow-[0_2px_10px_rgba(34,197,94,0.4)] cursor-pointer"
                >
                  Apply & View Results
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
