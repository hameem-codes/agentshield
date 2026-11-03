export type EventDecision = 'Allowed' | 'Review' | 'Blocked';
export type ExecutionStatus = 'Executed' | 'Not Executed' | 'Pending';

export interface SecurityEventRecord {
  id: string;
  timestamp: string;
  timestampRaw: number; // for sorting
  agent: string;
  tool: string;
  decision: EventDecision;
  riskScore: number;
  execution: ExecutionStatus;
  policy: string;
  // Detail modal fields
  actionSummary?: string;
  callerIp?: string;
  targetResource?: string;
  argumentsPayload?: Record<string, unknown> | string;
  responsePayload?: Record<string, unknown> | string;
  riskFactors?: string[];
  policyMatchedRule?: string;
  decisionRationale?: string;
}

export interface EventsFilterState {
  searchQuery: string;
  decision: EventDecision | 'All';
  agent: string; // 'All' or specific agent
  tool: string; // 'All' or specific tool
  riskRange: 'All' | 'Low (0-30)' | 'Medium (31-70)' | 'High (71-100)';
  execution: ExecutionStatus | 'All';
  policy: string; // 'All' or specific policy
}

