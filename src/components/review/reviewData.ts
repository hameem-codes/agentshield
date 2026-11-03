import type { ReviewRequest } from './reviewTypes';

export const INITIAL_PENDING_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_9f2d8a7c',
    title: 'Read sensitive documents',
    description: 'Read sensitive documents',
    agent: 'research-agent',
    tool: 'read_web',
    riskScore: 87,
    riskLevel: 'High',
    requestedAt: '2 min ago',
    requestedAtTimestamp: Date.now() - 2 * 60 * 1000,
    expiresIn: '28 min',
    expiresInMinutes: 28,
    status: 'Pending',
    proposedByText: 'Proposed by research-agent · 2 min ago',
    actionPayload: {
      url: 'https://docs.internal.company.com/sensitive/...',
      limit: 50
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Requires human approval'
    },
    riskFactors: 'Sensitive data access, high volume',
    injectionCheck: {
      passed: true,
      text: 'No injection patterns detected'
    },
    policyContext: {
      name: 'Policy: Research v2',
      version: 'Version: v2.3.1',
      hash: 'Hash: 7f2c9e4...'
    }
  },
  {
    id: 'rev_7a4e91d2',
    title: 'Bulk data export (50,000 rows)',
    description: 'Bulk data export (50,000 rows)',
    agent: 'data-agent',
    tool: 'export_db',
    riskScore: 78,
    riskLevel: 'High',
    requestedAt: '5 min ago',
    requestedAtTimestamp: Date.now() - 5 * 60 * 1000,
    expiresIn: '25 min',
    expiresInMinutes: 25,
    status: 'Pending',
    proposedByText: 'Proposed by data-agent · 5 min ago',
    actionPayload: {
      table: 'customer_metrics_warehouse',
      format: 'parquet',
      batch_size: 50000,
      destination: 's3://analytics-export/cold/'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Bulk export threshold > 10,000 rows'
    },
    riskFactors: 'High data exfiltration risk, egress volume',
    injectionCheck: {
      passed: true,
      text: 'Query sanitized, no injection detected'
    },
    policyContext: {
      name: 'Policy: Data Access v3',
      version: 'Version: v3.1.0',
      hash: 'Hash: 4a9e1d8...'
    }
  },
  {
    id: 'rev_c3b7e4f1',
    title: 'Send email to external domain',
    description: 'Send email to external domain',
    agent: 'email-agent',
    tool: 'send_email',
    riskScore: 68,
    riskLevel: 'Medium',
    requestedAt: '8 min ago',
    requestedAtTimestamp: Date.now() - 8 * 60 * 1000,
    expiresIn: '22 min',
    expiresInMinutes: 22,
    status: 'Pending',
    proposedByText: 'Proposed by email-agent · 8 min ago',
    actionPayload: {
      recipient: 'external-partner@partner-corp.io',
      subject: 'Security telemetry sync package',
      attachments: ['spec_summary.pdf']
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Outbound dispatch to non-allowlisted domain'
    },
    riskFactors: 'External domain communication, unverified recipient',
    injectionCheck: {
      passed: true,
      text: 'No prompt injection signatures found'
    },
    policyContext: {
      name: 'Policy: Restricted v1',
      version: 'Version: v1.4.2',
      hash: 'Hash: c3b7e21...'
    }
  },
  {
    id: 'rev_1d9a8b0e',
    title: 'Access restricted API',
    description: 'Access restricted API',
    agent: 'ops-agent',
    tool: 'api_call',
    riskScore: 63,
    riskLevel: 'Medium',
    requestedAt: '12 min ago',
    requestedAtTimestamp: Date.now() - 12 * 60 * 1000,
    expiresIn: '18 min',
    expiresInMinutes: 18,
    status: 'Pending',
    proposedByText: 'Proposed by ops-agent · 12 min ago',
    actionPayload: {
      endpoint: '/api/v1/cluster/admin/nodes',
      method: 'POST',
      scope: 'cluster:node:reboot'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Administrative privilege level escalation'
    },
    riskFactors: 'Infrastructure reboot authorization required',
    injectionCheck: {
      passed: true,
      text: 'Payload structure validated'
    },
    policyContext: {
      name: 'Policy: Operations v1',
      version: 'Version: v1.1.9',
      hash: 'Hash: 1d9a8b0...'
    }
  },
  {
    id: 'rev_8e2c7d9f',
    title: 'Modify production record',
    description: 'Modify production record',
    agent: 'data-agent',
    tool: 'update_record',
    riskScore: 82,
    riskLevel: 'High',
    requestedAt: '15 min ago',
    requestedAtTimestamp: Date.now() - 15 * 60 * 1000,
    expiresIn: '15 min',
    expiresInMinutes: 15,
    status: 'Pending',
    proposedByText: 'Proposed by data-agent · 15 min ago',
    actionPayload: {
      table: 'production_routing_flags',
      condition: 'service_id = "srv_billing_ingress"',
      updates: { 'routing_mode': 'canary_v2' }
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Production config modification restricted'
    },
    riskFactors: 'Direct write to billing service flags',
    injectionCheck: {
      passed: true,
      text: 'Parameterized query verified'
    },
    policyContext: {
      name: 'Policy: Operations v1',
      version: 'Version: v1.1.9',
      hash: 'Hash: 8e2c7d9...'
    }
  },
  {
    id: 'rev_4b1a2c6d',
    title: 'Download large dataset',
    description: 'Download large dataset',
    agent: 'research-agent',
    tool: 'download_file',
    riskScore: 71,
    riskLevel: 'Medium',
    requestedAt: '18 min ago',
    requestedAtTimestamp: Date.now() - 18 * 60 * 1000,
    expiresIn: '12 min',
    expiresInMinutes: 12,
    status: 'Pending',
    proposedByText: 'Proposed by research-agent · 18 min ago',
    actionPayload: {
      source_url: 'https://datasets.research-partner.org/benchmark_eval.tar.gz',
      file_size_mb: 4850,
      verify_hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Bandwidth threshold (>1GB) exceeded'
    },
    riskFactors: 'Large archive download from third-party repo',
    injectionCheck: {
      passed: true,
      text: 'No malicious URI patterns found'
    },
    policyContext: {
      name: 'Policy: Research v2',
      version: 'Version: v2.3.1',
      hash: 'Hash: 4b1a2c6...'
    }
  }
];

export const INITIAL_APPROVED_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_a2b3c4d5',
    title: 'Query system telemetry log',
    description: 'Query system telemetry log',
    agent: 'ops-agent',
    tool: 'api_call',
    riskScore: 42,
    riskLevel: 'Medium',
    requestedAt: '45 min ago',
    requestedAtTimestamp: Date.now() - 45 * 60 * 1000,
    expiresIn: 'Approved',
    expiresInMinutes: 0,
    status: 'Approved',
    proposedByText: 'Proposed by ops-agent · 45 min ago',
    actionPayload: {
      endpoint: '/api/v1/metrics/health',
      method: 'GET'
    },
    policyCheck: {
      status: 'passed',
      text: 'Approved by secops_lead'
    },
    riskFactors: 'Routine read-only telemetry query',
    injectionCheck: {
      passed: true,
      text: 'Passed automated check'
    },
    policyContext: {
      name: 'Policy: Operations v1',
      version: 'Version: v1.1.9',
      hash: 'Hash: a2b3c4d...'
    }
  }
];

export const INITIAL_DENIED_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_e6f7a8b9',
    title: 'Delete legacy customer backups',
    description: 'Delete legacy customer backups',
    agent: 'data-agent',
    tool: 'update_record',
    riskScore: 94,
    riskLevel: 'Critical',
    requestedAt: '2 hours ago',
    requestedAtTimestamp: Date.now() - 120 * 60 * 1000,
    expiresIn: 'Denied',
    expiresInMinutes: 0,
    status: 'Denied',
    proposedByText: 'Proposed by data-agent · 2 hours ago',
    actionPayload: {
      command: 'DELETE FROM backups WHERE age_days > 365',
      cascade: true
    },
    policyCheck: {
      status: 'failed',
      text: 'Denied: Destruction of archival backups forbidden'
    },
    riskFactors: 'Permanent data destruction danger',
    injectionCheck: {
      passed: true,
      text: 'Query sanitized'
    },
    policyContext: {
      name: 'Policy: Data Access v3',
      version: 'Version: v3.1.0',
      hash: 'Hash: e6f7a8b...'
    }
  }
];

export const INITIAL_EXPIRED_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_0f1e2d3c',
    title: 'Fetch unindexed archive segment',
    description: 'Fetch unindexed archive segment',
    agent: 'research-agent',
    tool: 'read_web',
    riskScore: 55,
    riskLevel: 'Medium',
    requestedAt: '1 hour ago',
    requestedAtTimestamp: Date.now() - 60 * 60 * 1000,
    expiresIn: 'Expired',
    expiresInMinutes: 0,
    status: 'Expired',
    proposedByText: 'Proposed by research-agent · 1 hour ago',
    actionPayload: {
      url: 'https://archive.org/stream/sample_corpus'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Approval window (30m) lapsed without human decision'
    },
    riskFactors: 'Time-to-live expired',
    injectionCheck: {
      passed: true,
      text: 'No injection found'
    },
    policyContext: {
      name: 'Policy: Research v2',
      version: 'Version: v2.3.1',
      hash: 'Hash: 0f1e2d3...'
    }
  }
];

