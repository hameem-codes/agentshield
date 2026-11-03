export type BenchmarkStatus = 'Completed' | 'Running' | 'Failed';

export interface CategoryResult {
  category: string;
  completed: number;
  total: number;
  ratio: string;
  passRate: number; // percentage (e.g. 100 or 75)
  description?: string;
}

export interface ComparisonMetric {
  category: string;
  baseline: number;
  protected: number;
  max: number;
}

export interface DecisionDistributionItem {
  decision: 'Allowed' | 'Review' | 'Blocked';
  percentage: number;
  count: number;
  color: string;
}

export interface BenchmarkRunRecord {
  id: string;
  dataset: string;
  policyVersion: string;
  total: number;
  blocked: number;
  fp: number;
  bypasses: number;
  status: BenchmarkStatus;
  timestamp: string;
  
  // Detailed metrics
  benignCases: number;
  maliciousCases: number;
  unauthorizedExecutionsBaseline: number;
  unauthorizedExecutionsProtected: number;
  blockedMaliciousBaseline: number;
  blockedMaliciousProtected: number;
  fpBaseline: number;
  fpProtected: number;
  benignAllowedBaseline: number;
  benignAllowedProtected: number;
  
  // Decision distribution
  allowedCount: number;
  allowedPercent: number;
  reviewCount: number;
  reviewPercent: number;
  blockedCount: number;
  blockedPercent: number;
  
  // Categories breakdown
  categoryResults: CategoryResult[];
}

export interface TestCaseRecord {
  id: string;
  category: string;
  type: 'Benign' | 'Malicious';
  agent: string;
  tool: string;
  description: string;
  payloadSummary: string;
  expectedOutcome: 'Allowed' | 'Review' | 'Blocked';
  actualOutcome: 'Allowed' | 'Review' | 'Blocked';
  riskScore: number;
  policyRule: string;
}

