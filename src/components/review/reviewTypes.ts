export type ReviewStatus = 'Pending' | 'Approved' | 'Denied' | 'Expired';

export interface ReviewRequest {
  id: string;
  title: string;
  description: string;
  agent: string;
  tool: string;
  riskScore: number;
  riskLevel: 'High' | 'Critical' | 'Medium' | 'Low';
  requestedAt: string;
  requestedAtTimestamp: number;
  expiresIn: string;
  expiresInMinutes: number;
  status: ReviewStatus;
  
  // Details for the right-side inspection panel
  proposedByText: string;
  actionPayload: Record<string, unknown>;
  policyCheck: {
    status: 'requires_approval' | 'passed' | 'failed';
    text: string;
  };
  riskFactors: string;
  injectionCheck: {
    passed: boolean;
    text: string;
  };
  policyContext: {
    name: string;
    version: string;
    hash: string;
  };
}

export interface ReviewFilterState {
  searchQuery: string;
  agent: string;
  tool: string;
  riskRange: string;
  sortBy: 'Newest' | 'Oldest' | 'Highest Risk' | 'Lowest Risk';
}

