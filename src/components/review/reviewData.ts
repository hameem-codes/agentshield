import type { ReviewRequest } from './reviewTypes';

export const INITIAL_PENDING_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_9f2d8a7c',
    title: 'Read Sensitive Documents',
    description: 'Read Sensitive Documents',
    agent: 'Research-Agent',
    tool: 'Read_Web',
    riskScore: 87,
    riskLevel: 'High',
    requestedAt: '2 Min Ago',
    requestedAtTimestamp: Date.now() - 2 * 60 * 1000,
    expiresIn: '28 Min',
    expiresInMinutes: 28,
    status: 'Pending',
    proposedByText: 'Proposed by Research-Agent · 2 Min Ago',
    actionPayload: {
      url: 'https://docs.internal.company.com/sensitive/...',
      limit: 50
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Requires Human Approval'
    },
    riskFactors: 'Sensitive Data Access, High Volume',
    injectionCheck: {
      passed: true,
      text: 'No Injection Patterns Detected'
    },
    policyContext: {
      name: 'Policy: Research v2',
      version: 'Version: V2.3.1',
      hash: 'Hash: 7f2c9e4...'
    }
  },
  {
    id: 'rev_7a4e91d2',
    title: 'Bulk Data Export (50,000 Rows)',
    description: 'Bulk Data Export (50,000 Rows)',
    agent: 'Data-Agent',
    tool: 'Export_Db',
    riskScore: 78,
    riskLevel: 'High',
    requestedAt: '5 Min Ago',
    requestedAtTimestamp: Date.now() - 5 * 60 * 1000,
    expiresIn: '25 Min',
    expiresInMinutes: 25,
    status: 'Pending',
    proposedByText: 'Proposed by Data-Agent · 5 Min Ago',
    actionPayload: {
      table: 'customer_metrics_warehouse',
      format: 'parquet',
      batch_size: 50000,
      destination: 's3://analytics-export/cold/'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Bulk Export Threshold > 10,000 Rows'
    },
    riskFactors: 'High Data Exfiltration Risk, Egress Volume',
    injectionCheck: {
      passed: true,
      text: 'Query Sanitized, No Injection Detected'
    },
    policyContext: {
      name: 'Policy: Data Access v3',
      version: 'Version: V3.1.0',
      hash: 'Hash: 4a9e1d8...'
    }
  },
  {
    id: 'rev_c3b7e4f1',
    title: 'Send Email to External Domain',
    description: 'Send Email to External Domain',
    agent: 'Email-Agent',
    tool: 'Send_Email',
    riskScore: 68,
    riskLevel: 'Medium',
    requestedAt: '8 Min Ago',
    requestedAtTimestamp: Date.now() - 8 * 60 * 1000,
    expiresIn: '22 Min',
    expiresInMinutes: 22,
    status: 'Pending',
    proposedByText: 'Proposed by Email-Agent · 8 Min Ago',
    actionPayload: {
      recipient: 'external-partner@partner-corp.io',
      subject: 'Security telemetry sync package',
      attachments: ['spec_summary.pdf']
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Outbound Dispatch to Non-Allowlisted Domain'
    },
    riskFactors: 'External Domain Communication, Unverified Recipient',
    injectionCheck: {
      passed: true,
      text: 'No Prompt Injection Signatures Found'
    },
    policyContext: {
      name: 'Policy: Restricted v1',
      version: 'Version: V1.4.2',
      hash: 'Hash: c3b7e21...'
    }
  },
  {
    id: 'rev_1d9a8b0e',
    title: 'Access Restricted API',
    description: 'Access Restricted API',
    agent: 'Ops-Agent',
    tool: 'Api_Call',
    riskScore: 63,
    riskLevel: 'Medium',
    requestedAt: '12 Min Ago',
    requestedAtTimestamp: Date.now() - 12 * 60 * 1000,
    expiresIn: '18 Min',
    expiresInMinutes: 18,
    status: 'Pending',
    proposedByText: 'Proposed by Ops-Agent · 12 Min Ago',
    actionPayload: {
      endpoint: '/api/v1/cluster/admin/nodes',
      method: 'POST',
      scope: 'cluster:node:reboot'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Administrative Privilege Level Escalation'
    },
    riskFactors: 'Infrastructure Reboot Authorization Required',
    injectionCheck: {
      passed: true,
      text: 'Payload Structure Validated'
    },
    policyContext: {
      name: 'Policy: Operations v1',
      version: 'Version: V1.1.9',
      hash: 'Hash: 1d9a8b0...'
    }
  },
  {
    id: 'rev_8e2c7d9f',
    title: 'Modify Production Record',
    description: 'Modify Production Record',
    agent: 'Data-Agent',
    tool: 'Update_Record',
    riskScore: 82,
    riskLevel: 'High',
    requestedAt: '15 Min Ago',
    requestedAtTimestamp: Date.now() - 15 * 60 * 1000,
    expiresIn: '15 Min',
    expiresInMinutes: 15,
    status: 'Pending',
    proposedByText: 'Proposed by Data-Agent · 15 Min Ago',
    actionPayload: {
      table: 'production_routing_flags',
      condition: 'service_id = "srv_billing_ingress"',
      updates: { 'routing_mode': 'canary_v2' }
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Production Config Modification Restricted'
    },
    riskFactors: 'Direct Write to Billing Service Flags',
    injectionCheck: {
      passed: true,
      text: 'Parameterized Query Verified'
    },
    policyContext: {
      name: 'Policy: Operations v1',
      version: 'Version: V1.1.9',
      hash: 'Hash: 8e2c7d9...'
    }
  },
  {
    id: 'rev_4b1a2c6d',
    title: 'Download Large Dataset',
    description: 'Download Large Dataset',
    agent: 'Research-Agent',
    tool: 'Download_File',
    riskScore: 71,
    riskLevel: 'Medium',
    requestedAt: '18 Min Ago',
    requestedAtTimestamp: Date.now() - 18 * 60 * 1000,
    expiresIn: '12 Min',
    expiresInMinutes: 12,
    status: 'Pending',
    proposedByText: 'Proposed by Research-Agent · 18 Min Ago',
    actionPayload: {
      source_url: 'https://datasets.research-partner.org/benchmark_eval.tar.gz',
      file_size_mb: 4850,
      verify_hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Bandwidth Threshold (>1GB) Exceeded'
    },
    riskFactors: 'Large Archive Download from Third-Party Repo',
    injectionCheck: {
      passed: true,
      text: 'No Malicious URI Patterns Found'
    },
    policyContext: {
      name: 'Policy: Research v2',
      version: 'Version: V2.3.1',
      hash: 'Hash: 4b1a2c6...'
    }
  }
];

export const INITIAL_APPROVED_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_a2b3c4d5',
    title: 'Query System Telemetry Log',
    description: 'Query System Telemetry Log',
    agent: 'Ops-Agent',
    tool: 'Api_Call',
    riskScore: 42,
    riskLevel: 'Medium',
    requestedAt: '45 Min Ago',
    requestedAtTimestamp: Date.now() - 45 * 60 * 1000,
    expiresIn: 'Approved',
    expiresInMinutes: 0,
    status: 'Approved',
    proposedByText: 'Proposed by Ops-Agent · 45 Min Ago',
    actionPayload: {
      endpoint: '/api/v1/metrics/health',
      method: 'GET'
    },
    policyCheck: {
      status: 'passed',
      text: 'Approved by SecOps Lead'
    },
    riskFactors: 'Routine Read-Only Telemetry Query',
    injectionCheck: {
      passed: true,
      text: 'Passed Automated Check'
    },
    policyContext: {
      name: 'Policy: Operations v1',
      version: 'Version: V1.1.9',
      hash: 'Hash: a2b3c4d...'
    }
  }
];

export const INITIAL_DENIED_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_e6f7a8b9',
    title: 'Delete Legacy Customer Backups',
    description: 'Delete Legacy Customer Backups',
    agent: 'Data-Agent',
    tool: 'Update_Record',
    riskScore: 94,
    riskLevel: 'Critical',
    requestedAt: '2 Hours Ago',
    requestedAtTimestamp: Date.now() - 120 * 60 * 1000,
    expiresIn: 'Denied',
    expiresInMinutes: 0,
    status: 'Denied',
    proposedByText: 'Proposed by Data-Agent · 2 Hours Ago',
    actionPayload: {
      command: 'DELETE FROM backups WHERE age_days > 365',
      cascade: true
    },
    policyCheck: {
      status: 'failed',
      text: 'Denied: Destruction of Archival Backups Forbidden'
    },
    riskFactors: 'Permanent Data Destruction Danger',
    injectionCheck: {
      passed: true,
      text: 'Query Sanitized'
    },
    policyContext: {
      name: 'Policy: Data Access v3',
      version: 'Version: V3.1.0',
      hash: 'Hash: e6f7a8b...'
    }
  }
];

export const INITIAL_EXPIRED_REQUESTS: ReviewRequest[] = [
  {
    id: 'rev_0f1e2d3c',
    title: 'Fetch Unindexed Archive Segment',
    description: 'Fetch Unindexed Archive Segment',
    agent: 'Research-Agent',
    tool: 'Read_Web',
    riskScore: 55,
    riskLevel: 'Medium',
    requestedAt: '1 Hour Ago',
    requestedAtTimestamp: Date.now() - 60 * 60 * 1000,
    expiresIn: 'Expired',
    expiresInMinutes: 0,
    status: 'Expired',
    proposedByText: 'Proposed by Research-Agent · 1 Hour Ago',
    actionPayload: {
      url: 'https://archive.org/stream/sample_corpus'
    },
    policyCheck: {
      status: 'requires_approval',
      text: 'Approval Window (30m) Lapsed Without Human Decision'
    },
    riskFactors: 'Time-To-Live Expired',
    injectionCheck: {
      passed: true,
      text: 'No Injection Found'
    },
    policyContext: {
      name: 'Policy: Research v2',
      version: 'Version: V2.3.1',
      hash: 'Hash: 0f1e2d3...'
    }
  }
];

