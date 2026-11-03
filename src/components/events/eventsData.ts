import type { SecurityEventRecord } from './eventsTypes';

export const INITIAL_PRIMARY_EVENTS: SecurityEventRecord[] = [
  {
    id: 'evt_9f2d8a7c',
    timestamp: 'Mon, 12 Jan 10:24:31',
    timestampRaw: 1736677471000,
    agent: 'research-agent',
    tool: 'read_web',
    decision: 'Allowed',
    riskScore: 24,
    execution: 'Executed',
    policy: 'Research v2',
    actionSummary: 'Fetched public documentation from developer portal',
    callerIp: '10.244.12.84',
    targetResource: 'https://docs.api.internal/v2/schema',
    argumentsPayload: {
      url: 'https://docs.api.internal/v2/schema',
      method: 'GET',
      timeout_ms: 3000,
      headers: { 'User-Agent': 'AgentShield-Research/2.4' }
    },
    responsePayload: {
      status: 200,
      bytes_read: 14208,
      content_type: 'application/json'
    },
    riskFactors: [
      'Target domain matches allowlist in Research v2',
      'No outbound credential transmission detected',
      'Payload entropy within normal bounds (4.12)'
    ],
    policyMatchedRule: 'RULE-RES-004: Public web read access permitted for validated domains',
    decisionRationale: 'Automated allow rule satisfied without human review required.'
  },
  {
    id: 'evt_7a4e91d2',
    timestamp: 'Mon, 12 Jan 10:21:08',
    timestampRaw: 1736677268000,
    agent: 'email-agent',
    tool: 'send_email',
    decision: 'Blocked',
    riskScore: 87,
    execution: 'Not Executed',
    policy: 'Restricted v1',
    actionSummary: 'Attempted to dispatch mass external email to unverified recipients',
    callerIp: '10.244.14.19',
    targetResource: 'smtp://gateway.internal:587',
    argumentsPayload: {
      recipients: ['external-contractor@partner-corp.io', 'unknown-user@anonmail.net'],
      subject: 'Urgent: Infrastructure Credentials Verification',
      attachments_count: 1,
      attachment_names: ['keys_dump.tar.gz']
    },
    responsePayload: {
      error: 'SECURITY_GATEWAY_INTERCEPT: Outbound transmission denied by Restricted v1',
      interception_id: 'int_blk_098842'
    },
    riskFactors: [
      'Unrecognized external domain anonmail.net',
      'Compressed archive payload contains sensitive keywords',
      'Risk score exceeded automated threshold 75'
    ],
    policyMatchedRule: 'RULE-EML-009: Strict outbound embargo on credentials and compressed archives',
    decisionRationale: 'High-risk payload blocked to prevent potential data exfiltration.'
  },
  {
    id: 'evt_c3b7e4f1',
    timestamp: 'Mon, 12 Jan 10:18:56',
    timestampRaw: 1736677136000,
    agent: 'ops-agent',
    tool: 'list_files',
    decision: 'Review',
    riskScore: 68,
    execution: 'Pending',
    policy: 'Operations v1',
    actionSummary: 'Directory traversal on production configuration mount',
    callerIp: '10.244.8.102',
    targetResource: '/etc/prod/configs/',
    argumentsPayload: {
      path: '/etc/prod/configs/',
      recursive: true,
      depth: 3,
      filter: '*.yaml'
    },
    responsePayload: {
      status: 'AWAITING_OPERATOR_APPROVAL',
      queue_ticket: 'REV-8921'
    },
    riskFactors: [
      'Accessed sensitive system path /etc/prod/',
      'Recursive listing of production configuration files',
      'Elevated privilege context required'
    ],
    policyMatchedRule: 'RULE-OPS-012: Deep file inspection in prod config zones requires manual confirmation',
    decisionRationale: 'Execution queued for security administrator approval in Review queue.'
  },
  {
    id: 'evt_1d9a8b0e',
    timestamp: 'Mon, 12 Jan 10:15:09',
    timestampRaw: 1736676909000,
    agent: 'data-agent',
    tool: 'query_db',
    decision: 'Allowed',
    riskScore: 24,
    execution: 'Executed',
    policy: 'Data Access v3',
    actionSummary: 'Executed sanitized read-only query on analytics warehouse',
    callerIp: '10.244.15.42',
    targetResource: 'postgres://analytics-ro.internal/metrics',
    argumentsPayload: {
      query: 'SELECT date, active_users FROM daily_telemetry WHERE date >= CURRENT_DATE - 7 LIMIT 100;',
      read_only: true,
      max_rows: 100
    },
    responsePayload: {
      row_count: 7,
      execution_time_ms: 18.4,
      status: 'SUCCESS'
    },
    riskFactors: [
      'Read-only connection string utilized',
      'Parameterized query without SQL injection vectors',
      'No PII table columns queried'
    ],
    policyMatchedRule: 'RULE-DB-002: Analytical telemetry reads granted under Data Access v3',
    decisionRationale: 'Sanitized read operation approved under automated runtime baseline.'
  },
  {
    id: 'evt_8e2c7d9f',
    timestamp: 'Mon, 12 Jan 10:11:34',
    timestampRaw: 1736676694000,
    agent: 'research-agent',
    tool: 'download_file',
    decision: 'Blocked',
    riskScore: 82,
    execution: 'Not Executed',
    policy: 'Research v2',
    actionSummary: 'Attempted download of untrusted binary from suspicious external IP',
    callerIp: '10.244.12.84',
    targetResource: 'http://185.220.101.5/bin/payload.elf',
    argumentsPayload: {
      url: 'http://185.220.101.5/bin/payload.elf',
      destination: '/tmp/scratch/payload.elf',
      sha256_verify: false
    },
    responsePayload: {
      error: 'MALWARE_REPUTATION_TRIGGER: Source IP listed on threat intelligence feed',
      interception_id: 'int_blk_098731'
    },
    riskFactors: [
      'Raw IP destination without valid reverse DNS',
      'Binary executable download target (.elf)',
      'Threat intel blacklist positive match'
    ],
    policyMatchedRule: 'RULE-RES-007: Unsigned binary executable downloads strictly prohibited',
    decisionRationale: 'Immediate block enforced. Binary download request rejected at socket layer.'
  },
  {
    id: 'evt_4b1a2c6d',
    timestamp: 'Mon, 12 Jan 10:07:18',
    timestampRaw: 1736676438000,
    agent: 'email-agent',
    tool: 'read_mail',
    decision: 'Allowed',
    riskScore: 18,
    execution: 'Executed',
    policy: 'Email v1',
    actionSummary: 'Retrieved incoming customer support inbox message headers',
    callerIp: '10.244.14.19',
    targetResource: 'imap://mail-relay.internal:993',
    argumentsPayload: {
      folder: 'INBOX/Support',
      max_messages: 20,
      unread_only: true
    },
    responsePayload: {
      messages_retrieved: 4,
      status: 'OK',
      processing_time_ms: 45
    },
    riskFactors: [
      'Standard internal IMAP endpoint authenticated with mTLS',
      'Low entropy metadata ingestion',
      'No write or dispatch privileges invoked'
    ],
    policyMatchedRule: 'RULE-EML-001: Inbox telemetry and inbound mail reading allowed',
    decisionRationale: 'Routine email ingestion permitted under default operational policy.'
  },
  {
    id: 'evt_d7f5a3e0',
    timestamp: 'Mon, 12 Jan 10:04:27',
    timestampRaw: 1736676267000,
    agent: 'ops-agent',
    tool: 'modify_record',
    decision: 'Review',
    riskScore: 63,
    execution: 'Pending',
    policy: 'Operations v1',
    actionSummary: 'Modification of routing rule in cloud gateway table',
    callerIp: '10.244.8.102',
    targetResource: 'gateway://edge-router-01/route_table',
    argumentsPayload: {
      target_route: '192.168.10.0/24',
      next_hop: '10.244.1.1',
      metric: 20
    },
    responsePayload: {
      status: 'AWAITING_MULTI_SIG_REVIEW',
      required_approvers: ['admin', 'secops_lead']
    },
    riskFactors: [
      'Core routing table modification',
      'Potential network traffic reroute impact',
      'Elevated blast radius for cluster services'
    ],
    policyMatchedRule: 'RULE-OPS-003: Core networking topology adjustments require two-person verification',
    decisionRationale: 'Security policy escalated action to review state pending operator sign-off.'
  },
  {
    id: 'evt_6c9e7b2a',
    timestamp: 'Mon, 12 Jan 10:01:05',
    timestampRaw: 1736676065000,
    agent: 'data-agent',
    tool: 'delete_record',
    decision: 'Blocked',
    riskScore: 91,
    execution: 'Not Executed',
    policy: 'Data Access v3',
    actionSummary: 'Attempted batch deletion on customer account records',
    callerIp: '10.244.15.42',
    targetResource: 'postgres://customers-db.internal/accounts',
    argumentsPayload: {
      table: 'accounts',
      condition: 'created_at < 2024-01-01',
      cascade: true
    },
    responsePayload: {
      error: 'CRITICAL_BLOCK: Unbounded destructive deletion intercepted',
      interception_id: 'int_blk_098619'
    },
    riskFactors: [
      'Unbounded DELETE statement without primary key scoping',
      'High severity score 91',
      'Customer master data table protection triggered'
    ],
    policyMatchedRule: 'RULE-DB-099: Destructive cascading deletion prohibited for automated agents',
    decisionRationale: 'Permanent data destruction rule triggered instant termination.'
  }
];

// Additional realistic records for pagination testing
export const ADDITIONAL_MOCK_EVENTS: SecurityEventRecord[] = [
  {
    id: 'evt_5e8d3c1b',
    timestamp: 'Mon, 12 Jan 09:58:40',
    timestampRaw: 1736675920000,
    agent: 'research-agent',
    tool: 'read_web',
    decision: 'Allowed',
    riskScore: 19,
    execution: 'Executed',
    policy: 'Research v2',
    actionSummary: 'Indexed technical specification RFC-8446',
    callerIp: '10.244.12.84',
    targetResource: 'https://datatracker.ietf.org/doc/html/rfc8446'
  },
  {
    id: 'evt_3a1f9e8d',
    timestamp: 'Mon, 12 Jan 09:54:12',
    timestampRaw: 1736675652000,
    agent: 'email-agent',
    tool: 'send_email',
    decision: 'Allowed',
    riskScore: 28,
    execution: 'Executed',
    policy: 'Email v1',
    actionSummary: 'Sent automated weekly activity summary to security team',
    callerIp: '10.244.14.19',
    targetResource: 'smtp://gateway.internal:587'
  },
  {
    id: 'evt_2b4c6a8e',
    timestamp: 'Mon, 12 Jan 09:49:50',
    timestampRaw: 1736675390000,
    agent: 'ops-agent',
    tool: 'list_files',
    decision: 'Allowed',
    riskScore: 15,
    execution: 'Executed',
    policy: 'Operations v1',
    actionSummary: 'Listed temporary scratch files in container volume',
    callerIp: '10.244.8.102',
    targetResource: '/tmp/job_output'
  },
  {
    id: 'evt_9c8b7a6d',
    timestamp: 'Mon, 12 Jan 09:44:21',
    timestampRaw: 1736675061000,
    agent: 'data-agent',
    tool: 'query_db',
    decision: 'Allowed',
    riskScore: 22,
    execution: 'Executed',
    policy: 'Data Access v3',
    actionSummary: 'Queried system uptime telemetry',
    callerIp: '10.244.15.42',
    targetResource: 'postgres://analytics-ro.internal/uptime'
  },
  {
    id: 'evt_1f4d8e9c',
    timestamp: 'Mon, 12 Jan 09:40:02',
    timestampRaw: 1736674802000,
    agent: 'ops-agent',
    tool: 'modify_record',
    decision: 'Review',
    riskScore: 66,
    execution: 'Pending',
    policy: 'Operations v1',
    actionSummary: 'Updated rate limiter threshold in cache store',
    callerIp: '10.244.8.102',
    targetResource: 'redis://ratelimit.internal:6379'
  },
  {
    id: 'evt_7e5a3b2c',
    timestamp: 'Mon, 12 Jan 09:35:19',
    timestampRaw: 1736674519000,
    agent: 'research-agent',
    tool: 'download_file',
    decision: 'Blocked',
    riskScore: 88,
    execution: 'Not Executed',
    policy: 'Research v2',
    actionSummary: 'Attempted to pull file from blacklisted mirror',
    callerIp: '10.244.12.84',
    targetResource: 'ftp://untrusted-mirror.cc/pkg.zip'
  },
  {
    id: 'evt_4d2b9f1a',
    timestamp: 'Mon, 12 Jan 09:30:45',
    timestampRaw: 1736674245000,
    agent: 'email-agent',
    tool: 'read_mail',
    decision: 'Allowed',
    riskScore: 16,
    execution: 'Executed',
    policy: 'Email v1',
    actionSummary: 'Read bounce notification messages from queue',
    callerIp: '10.244.14.19',
    targetResource: 'imap://mail-relay.internal:993'
  },
  {
    id: 'evt_8a3c5e7b',
    timestamp: 'Mon, 12 Jan 09:25:30',
    timestampRaw: 1736673930000,
    agent: 'data-agent',
    tool: 'delete_record',
    decision: 'Blocked',
    riskScore: 94,
    execution: 'Not Executed',
    policy: 'Data Access v3',
    actionSummary: 'Attempted drop table command in customer schema',
    callerIp: '10.244.15.42',
    targetResource: 'postgres://customers-db.internal/audit_log'
  }
];

export const ALL_EVENTS: SecurityEventRecord[] = [
  ...INITIAL_PRIMARY_EVENTS,
  ...ADDITIONAL_MOCK_EVENTS
];

