export type PolicyStatus = 'Active' | 'Draft' | 'Archived';

export interface PolicyRule {
  allowedTools: string[];
  argumentLimits: {
    maxItemsPerRequest: number;
    maxFileSize: string;
  };
  allowedHostnames: string[];
  defaultDeny: boolean;
  reviewThreshold: number;
  auditAllActions: boolean;
}

export interface PolicyVersionRecord {
  version: string;
  date: string;
  author: string;
  description: string;
  isCurrent?: boolean;
}

export interface AssignedAgentInfo {
  id: string;
  name: string;
  runtime: string;
  assignedDate: string;
  status: 'Active' | 'Paused' | 'Blocked';
}

export interface SecurityPolicy {
  id: string;
  name: string;
  version: string;
  status: PolicyStatus;
  description: string;
  assignedAgentNames: string[];
  lastUpdated: string;
  lastUpdatedTimestamp: number;
  rules: PolicyRule;
  versions: PolicyVersionRecord[];
  agents: AssignedAgentInfo[];
}

export interface PolicyFilterState {
  searchQuery: string;
  status: PolicyStatus | 'All';
  assignedAgent: string; // 'All' or specific agent
}

