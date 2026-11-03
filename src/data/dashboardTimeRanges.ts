import type { AttentionItem } from '../types';

export type TimeRangeKey = 'Last 24 Hours' | 'Last 7 Days' | 'Last 30 Days' | 'This Month';

export interface DayActivityData {
  day: string;
  allowed: number;
  review: number;
  blocked: number;
}

export interface KpiCardData {
  value: number;
  change: number;
  peakLabel?: string;
  peakValue?: string;
  sparkline?: number[];
  sparklineUnit?: string;
}

export interface RiskTierData {
  name: string;
  range: string;
  percentage: number;
  count: number;
  color: string;
}

export interface AgentSummaryData {
  id: string;
  name: string;
  status: 'Active' | 'Paused';
  policy: string;
  eventsCount: number;
  blockedCount: number;
  blockedRate: string;
  runtime: string;
  lastActive: string;
  description: string;
}

export interface RecentEventData {
  id: string;
  agent: string;
  action: string;
  decision: 'Allowed' | 'Review' | 'Blocked';
  riskScore: number;
  timeAgo: string;
}

export interface TimeRangeDataset {
  label: TimeRangeKey;
  totalEvents: {
    value: number;
    change: number;
    avgRate: string;
  };
  allowed: KpiCardData;
  review: KpiCardData;
  blocked: KpiCardData;
  chart: {
    data: DayActivityData[];
    maxY: number;
    ticks: number[];
    peak: string;
    unit: string;
  };
  distribution: {
    total: number;
    allowed: { percentage: number; count: number };
    review: { percentage: number; count: number };
    blocked: { percentage: number; count: number };
  };
  risk: {
    criticalPercentage: number;
    tiers: RiskTierData[];
  };
  agents: {
    columnLabel: string;
    list: AgentSummaryData[];
  };
  recentEvents: RecentEventData[];
  attention: {
    badgeCount: number;
    items: AttentionItem[];
  };
}

export const DASHBOARD_TIME_RANGES: Record<TimeRangeKey, TimeRangeDataset> = {
  'Last 7 Days': {
    label: 'Last 7 Days',
    totalEvents: {
      value: 3842,
      change: 12,
      avgRate: '548/Day Avg',
    },
    allowed: {
      value: 2976,
      change: 14,
      peakLabel: 'Peak:',
      peakValue: '490/Day',
      sparkline: [240, 270, 250, 320, 390, 380, 490],
      sparklineUnit: '/d',
    },
    review: {
      value: 437,
      change: 6,
      peakLabel: 'Peak:',
      peakValue: '65/d',
      sparkline: [45, 50, 48, 55, 60, 52, 65],
      sparklineUnit: '/d',
    },
    blocked: {
      value: 429,
      change: 18,
      peakLabel: 'Peak:',
      peakValue: '58/Day',
      sparkline: [30, 42, 35, 48, 50, 42, 58],
      sparklineUnit: '/d',
    },
    chart: {
      maxY: 800,
      ticks: [800, 600, 400, 200, 0],
      peak: 'Peak: 720/d',
      unit: 'd',
      data: [
        { day: 'Tue', allowed: 380, review: 85, blocked: 42 },
        { day: 'Wed', allowed: 460, review: 95, blocked: 48 },
        { day: 'Thu', allowed: 390, review: 88, blocked: 40 },
        { day: 'Fri', allowed: 480, review: 105, blocked: 52 },
        { day: 'Sat', allowed: 540, review: 95, blocked: 45 },
        { day: 'Sun', allowed: 570, review: 88, blocked: 40 },
        { day: 'Mon', allowed: 720, review: 125, blocked: 62 },
      ],
    },
    distribution: {
      total: 3842,
      allowed: { percentage: 77.5, count: 2976 },
      review: { percentage: 11.4, count: 437 },
      blocked: { percentage: 11.2, count: 429 },
    },
    risk: {
      criticalPercentage: 3.4,
      tiers: [
        { name: 'Critical', range: '(81–100)', percentage: 3.4, count: 132, color: '#ef4444' },
        { name: 'High', range: '(61–80)', percentage: 8.9, count: 341, color: '#f97316' },
        { name: 'Medium', range: '(31–60)', percentage: 22.8, count: 876, color: '#eab308' },
        { name: 'Low', range: '(0–30)', percentage: 64.9, count: 2493, color: '#22c55e' },
      ],
    },
    agents: {
      columnLabel: 'Events (7d)',
      list: [
        {
          id: 'Research-Agent',
          name: 'Research-Agent',
          status: 'Active',
          policy: 'Research v2',
          eventsCount: 1248,
          blockedCount: 142,
          blockedRate: '11.4%',
          runtime: 'LangChain v0.3',
          lastActive: '2m ago',
          description: 'Autonomous web research and citation retrieval agent.',
        },
        {
          id: 'Ops-Agent',
          name: 'Ops-Agent',
          status: 'Active',
          policy: 'Operations v1',
          eventsCount: 978,
          blockedCount: 118,
          blockedRate: '12.1%',
          runtime: 'CrewAI v0.2',
          lastActive: '12m ago',
          description: 'DevOps automation agent with filesystem and bash command permissions.',
        },
        {
          id: 'Data-Agent',
          name: 'Data-Agent',
          status: 'Active',
          policy: 'Data Access v3',
          eventsCount: 840,
          blockedCount: 116,
          blockedRate: '13.8%',
          runtime: 'LlamaIndex v0.10',
          lastActive: '18m ago',
          description: 'Internal analytical query synthesizer for relational data lakes.',
        },
        {
          id: 'Email-Agent',
          name: 'Email-Agent',
          status: 'Paused',
          policy: 'Restricted v1',
          eventsCount: 421,
          blockedCount: 53,
          blockedRate: '12.6%',
          runtime: 'Python Autogen v0.4',
          lastActive: '34m Ago',
          description: 'Customer notification dispatch agent paused due to high risk anomaly.',
        },
      ],
    },
    recentEvents: [
      { id: 'ev-1', agent: 'Research-Agent', action: 'Read_Web', decision: 'Allowed', riskScore: 12, timeAgo: '2 Min Ago' },
      { id: 'ev-2', agent: 'Email-Agent', action: 'Send_Email', decision: 'Blocked', riskScore: 87, timeAgo: '7 Min Ago' },
      { id: 'ev-3', agent: 'Ops-Agent', action: 'List_Files', decision: 'Review', riskScore: 68, timeAgo: '12 Min Ago' },
      { id: 'ev-4', agent: 'Data-Agent', action: 'Query_Db', decision: 'Allowed', riskScore: 24, timeAgo: '18 Min Ago' },
    ],
    attention: {
      badgeCount: 6,
      items: [
        {
          id: 'review-actions',
          iconType: 'review',
          text: '6 Actions Awaiting Review',
          count: 6,
          severity: 'yellow',
          details: 'Supervisory sign-off required for file system write permissions across Ops-Agent.',
        },
        {
          id: 'paused-agent',
          iconType: 'paused',
          text: '1 Agent Paused',
          count: 1,
          severity: 'orange',
          details: 'Email-Agent auto-paused following anomalous credential spray detection.',
        },
        {
          id: 'high-risk',
          iconType: 'risk',
          text: '17 High-Risk Events (≥ 61)',
          count: 17,
          severity: 'red',
          details: '17 events flagged with elevated heuristic risk in the last evaluation cycle.',
        },
        {
          id: 'policy-changes',
          iconType: 'policy',
          text: '5 Policy Changes in Last 7d',
          count: 5,
          severity: 'purple',
          details: 'Updated Research v2 sandbox definitions and restricted outbound ports.',
        },
      ],
    },
  },

  'Last 24 Hours': {
    label: 'Last 24 Hours',
    totalEvents: {
      value: 564,
      change: 9,
      avgRate: '24/hr avg',
    },
    allowed: {
      value: 438,
      change: 8,
      peakLabel: 'Peak:',
      peakValue: '89/h',
      sparkline: [38, 45, 52, 60, 72, 82, 89],
      sparklineUnit: '/h',
    },
    review: {
      value: 68,
      change: 3,
      peakLabel: 'Peak:',
      peakValue: '12/h',
      sparkline: [7, 8, 11, 9, 10, 11, 12],
      sparklineUnit: '/h',
    },
    blocked: {
      value: 58,
      change: 15,
      peakLabel: 'Peak:',
      peakValue: '12/h',
      sparkline: [4, 6, 8, 7, 9, 12, 12],
      sparklineUnit: '/h',
    },
    chart: {
      maxY: 120,
      ticks: [120, 90, 60, 30, 0],
      peak: 'Peak: 89/h',
      unit: 'h',
      data: [
        { day: '00:00', allowed: 38, review: 7, blocked: 4 },
        { day: '04:00', allowed: 45, review: 8, blocked: 6 },
        { day: '08:00', allowed: 52, review: 11, blocked: 8 },
        { day: '12:00', allowed: 60, review: 9, blocked: 7 },
        { day: '16:00', allowed: 72, review: 10, blocked: 9 },
        { day: '20:00', allowed: 82, review: 11, blocked: 12 },
        { day: 'Now', allowed: 89, review: 12, blocked: 12 },
      ],
    },
    distribution: {
      total: 564,
      allowed: { percentage: 77.7, count: 438 },
      review: { percentage: 12.1, count: 68 },
      blocked: { percentage: 10.2, count: 58 },
    },
    risk: {
      criticalPercentage: 3.2,
      tiers: [
        { name: 'Critical', range: '(81–100)', percentage: 3.2, count: 18, color: '#ef4444' },
        { name: 'High', range: '(61–80)', percentage: 8.7, count: 49, color: '#f97316' },
        { name: 'Medium', range: '(31–60)', percentage: 22.3, count: 126, color: '#eab308' },
        { name: 'Low', range: '(0–30)', percentage: 65.8, count: 371, color: '#22c55e' },
      ],
    },
    agents: {
      columnLabel: 'Events (24h)',
      list: [
        {
          id: 'Research-Agent',
          name: 'Research-Agent',
          status: 'Active',
          policy: 'Research v2',
          eventsCount: 184,
          blockedCount: 21,
          blockedRate: '11.4%',
          runtime: 'LangChain v0.3',
          lastActive: 'Just now',
          description: 'Autonomous web research and citation retrieval agent.',
        },
        {
          id: 'Ops-Agent',
          name: 'Ops-Agent',
          status: 'Active',
          policy: 'Operations v1',
          eventsCount: 146,
          blockedCount: 18,
          blockedRate: '12.3%',
          runtime: 'CrewAI v0.2',
          lastActive: '5m ago',
          description: 'DevOps automation agent with filesystem and bash command permissions.',
        },
        {
          id: 'Data-Agent',
          name: 'Data-Agent',
          status: 'Active',
          policy: 'Data Access v3',
          eventsCount: 124,
          blockedCount: 17,
          blockedRate: '13.7%',
          runtime: 'LlamaIndex v0.10',
          lastActive: '11m ago',
          description: 'Internal analytical query synthesizer for relational data lakes.',
        },
        {
          id: 'Email-Agent',
          name: 'Email-Agent',
          status: 'Paused',
          policy: 'Restricted v1',
          eventsCount: 62,
          blockedCount: 8,
          blockedRate: '12.9%',
          runtime: 'Python Autogen v0.4',
          lastActive: '28m ago',
          description: 'Customer notification dispatch agent paused due to high risk anomaly.',
        },
      ],
    },
    recentEvents: [
      { id: 'ev-1', agent: 'Research-Agent', action: 'Read_Web', decision: 'Allowed', riskScore: 12, timeAgo: 'Just now' },
      { id: 'ev-2', agent: 'Email-Agent', action: 'Send_Email', decision: 'Blocked', riskScore: 87, timeAgo: '3 min ago' },
      { id: 'ev-3', agent: 'Ops-Agent', action: 'List_Files', decision: 'Review', riskScore: 68, timeAgo: '8 min ago' },
      { id: 'ev-4', agent: 'Data-Agent', action: 'Query_Db', decision: 'Allowed', riskScore: 24, timeAgo: '14 min ago' },
    ],
    attention: {
      badgeCount: 2,
      items: [
        {
          id: 'review-actions',
          iconType: 'review',
          text: '2 Actions Awaiting Review',
          count: 2,
          severity: 'yellow',
          details: 'Supervisory sign-off required for file system write permissions across Ops-Agent.',
        },
        {
          id: 'paused-agent',
          iconType: 'paused',
          text: '1 Agent Paused',
          count: 1,
          severity: 'orange',
          details: 'Email-Agent auto-paused following anomalous credential spray detection.',
        },
        {
          id: 'high-risk',
          iconType: 'risk',
          text: '4 High-Risk Events (≥ 61)',
          count: 4,
          severity: 'red',
          details: '4 events flagged with elevated heuristic risk in the last 24 hours.',
        },
        {
          id: 'policy-changes',
          iconType: 'policy',
          text: '2 Policy Changes in Last 24h',
          count: 2,
          severity: 'purple',
          details: 'Updated Research v2 sandbox definitions and restricted outbound ports.',
        },
      ],
    },
  },

  'Last 30 Days': {
    label: 'Last 30 Days',
    totalEvents: {
      value: 16420,
      change: 19,
      avgRate: '547/day avg',
    },
    allowed: {
      value: 12850,
      change: 22,
      peakLabel: 'Peak:',
      peakValue: '2.9k/w',
      sparkline: [1850, 2200, 2480, 2750, 2980],
      sparklineUnit: '/w',
    },
    review: {
      value: 1840,
      change: 11,
      peakLabel: 'Peak:',
      peakValue: '420/w',
      sparkline: [310, 340, 390, 380, 420],
      sparklineUnit: '/w',
    },
    blocked: {
      value: 1730,
      change: 25,
      peakLabel: 'Peak:',
      peakValue: '400/w',
      sparkline: [280, 310, 350, 400, 390],
      sparklineUnit: '/w',
    },
    chart: {
      maxY: 3500,
      ticks: [3500, 2500, 1500, 500, 0],
      peak: 'Peak: 2,980/w',
      unit: 'w',
      data: [
        { day: 'Week 1', allowed: 1850, review: 310, blocked: 280 },
        { day: 'Week 2', allowed: 2200, review: 340, blocked: 310 },
        { day: 'Week 3', allowed: 2480, review: 390, blocked: 350 },
        { day: 'Week 4', allowed: 2750, review: 380, blocked: 400 },
        { day: 'Current', allowed: 2980, review: 420, blocked: 390 },
      ],
    },
    distribution: {
      total: 16420,
      allowed: { percentage: 78.3, count: 12850 },
      review: { percentage: 11.2, count: 1840 },
      blocked: { percentage: 10.5, count: 1730 },
    },
    risk: {
      criticalPercentage: 3.3,
      tiers: [
        { name: 'Critical', range: '(81–100)', percentage: 3.3, count: 542, color: '#ef4444' },
        { name: 'High', range: '(61–80)', percentage: 8.9, count: 1460, color: '#f97316' },
        { name: 'Medium', range: '(31–60)', percentage: 22.8, count: 3740, color: '#eab308' },
        { name: 'Low', range: '(0–30)', percentage: 65.0, count: 10678, color: '#22c55e' },
      ],
    },
    agents: {
      columnLabel: 'Events (30d)',
      list: [
        {
          id: 'Research-Agent',
          name: 'Research-Agent',
          status: 'Active',
          policy: 'Research v2',
          eventsCount: 5340,
          blockedCount: 610,
          blockedRate: '11.4%',
          runtime: 'LangChain v0.3',
          lastActive: '2m ago',
          description: 'Autonomous web research and citation retrieval agent.',
        },
        {
          id: 'Ops-Agent',
          name: 'Ops-Agent',
          status: 'Active',
          policy: 'Operations v1',
          eventsCount: 4180,
          blockedCount: 505,
          blockedRate: '12.1%',
          runtime: 'CrewAI v0.2',
          lastActive: '12m ago',
          description: 'DevOps automation agent with filesystem and bash command permissions.',
        },
        {
          id: 'Data-Agent',
          name: 'Data-Agent',
          status: 'Active',
          policy: 'Data Access v3',
          eventsCount: 3610,
          blockedCount: 498,
          blockedRate: '13.8%',
          runtime: 'LlamaIndex v0.10',
          lastActive: '18m ago',
          description: 'Internal analytical query synthesizer for relational data lakes.',
        },
        {
          id: 'Email-Agent',
          name: 'Email-Agent',
          status: 'Paused',
          policy: 'Restricted v1',
          eventsCount: 1820,
          blockedCount: 227,
          blockedRate: '12.5%',
          runtime: 'Python Autogen v0.4',
          lastActive: '34m Ago',
          description: 'Customer notification dispatch agent paused due to high risk anomaly.',
        },
      ],
    },
    recentEvents: [
      { id: 'ev-1', agent: 'Research-Agent', action: 'Read_Web', decision: 'Allowed', riskScore: 12, timeAgo: '1 hr ago' },
      { id: 'ev-2', agent: 'Email-Agent', action: 'Send_Email', decision: 'Blocked', riskScore: 87, timeAgo: '4 hrs ago' },
      { id: 'ev-3', agent: 'Ops-Agent', action: 'List_Files', decision: 'Review', riskScore: 68, timeAgo: '1 day ago' },
      { id: 'ev-4', agent: 'Data-Agent', action: 'Query_Db', decision: 'Allowed', riskScore: 24, timeAgo: '2 days ago' },
    ],
    attention: {
      badgeCount: 14,
      items: [
        {
          id: 'review-actions',
          iconType: 'review',
          text: '14 Actions Awaiting Review',
          count: 14,
          severity: 'yellow',
          details: 'Supervisory sign-off required for file system write permissions across Ops-Agent.',
        },
        {
          id: 'paused-agent',
          iconType: 'paused',
          text: '1 Agent Paused',
          count: 1,
          severity: 'orange',
          details: 'Email-Agent auto-paused following anomalous credential spray detection.',
        },
        {
          id: 'high-risk',
          iconType: 'risk',
          text: '58 High-Risk Events (≥ 61)',
          count: 58,
          severity: 'red',
          details: '58 events flagged with elevated heuristic risk in the last 30 days.',
        },
        {
          id: 'policy-changes',
          iconType: 'policy',
          text: '12 Policy Changes in Last 30d',
          count: 12,
          severity: 'purple',
          details: 'Updated Research v2 sandbox definitions and restricted outbound ports.',
        },
      ],
    },
  },

  'This Month': {
    label: 'This Month',
    totalEvents: {
      value: 12180,
      change: 14,
      avgRate: '530/day avg',
    },
    allowed: {
      value: 9510,
      change: 16,
      peakLabel: 'Peak:',
      peakValue: '2.6k/w',
      sparkline: [1620, 2180, 2410, 2640],
      sparklineUnit: '/w',
    },
    review: {
      value: 1380,
      change: 8,
      peakLabel: 'Peak:',
      peakValue: '380/w',
      sparkline: [280, 340, 380, 380],
      sparklineUnit: '/w',
    },
    blocked: {
      value: 1290,
      change: 20,
      peakLabel: 'Peak:',
      peakValue: '360/w',
      sparkline: [260, 310, 360, 360],
      sparklineUnit: '/w',
    },
    chart: {
      maxY: 3000,
      ticks: [3000, 2000, 1000, 0],
      peak: 'Peak: 2,640/w',
      unit: 'w',
      data: [
        { day: 'Week 1', allowed: 1620, review: 280, blocked: 260 },
        { day: 'Week 2', allowed: 2180, review: 340, blocked: 310 },
        { day: 'Week 3', allowed: 2410, review: 380, blocked: 360 },
        { day: 'Week 4', allowed: 2640, review: 380, blocked: 360 },
      ],
    },
    distribution: {
      total: 12180,
      allowed: { percentage: 78.1, count: 9510 },
      review: { percentage: 11.3, count: 1380 },
      blocked: { percentage: 10.6, count: 1290 },
    },
    risk: {
      criticalPercentage: 3.3,
      tiers: [
        { name: 'Critical', range: '(81–100)', percentage: 3.3, count: 402, color: '#ef4444' },
        { name: 'High', range: '(61–80)', percentage: 8.8, count: 1072, color: '#f97316' },
        { name: 'Medium', range: '(31–60)', percentage: 22.9, count: 2789, color: '#eab308' },
        { name: 'Low', range: '(0–30)', percentage: 65.0, count: 7917, color: '#22c55e' },
      ],
    },
    agents: {
      columnLabel: 'Events (Mo)',
      list: [
        {
          id: 'Research-Agent',
          name: 'Research-Agent',
          status: 'Active',
          policy: 'Research v2',
          eventsCount: 3960,
          blockedCount: 451,
          blockedRate: '11.4%',
          runtime: 'LangChain v0.3',
          lastActive: '2m ago',
          description: 'Autonomous web research and citation retrieval agent.',
        },
        {
          id: 'Ops-Agent',
          name: 'Ops-Agent',
          status: 'Active',
          policy: 'Operations v1',
          eventsCount: 3100,
          blockedCount: 375,
          blockedRate: '12.1%',
          runtime: 'CrewAI v0.2',
          lastActive: '12m ago',
          description: 'DevOps automation agent with filesystem and bash command permissions.',
        },
        {
          id: 'Data-Agent',
          name: 'Data-Agent',
          status: 'Active',
          policy: 'Data Access v3',
          eventsCount: 2670,
          blockedCount: 368,
          blockedRate: '13.8%',
          runtime: 'LlamaIndex v0.10',
          lastActive: '18m ago',
          description: 'Internal analytical query synthesizer for relational data lakes.',
        },
        {
          id: 'Email-Agent',
          name: 'Email-Agent',
          status: 'Paused',
          policy: 'Restricted v1',
          eventsCount: 1350,
          blockedCount: 169,
          blockedRate: '12.5%',
          runtime: 'Python Autogen v0.4',
          lastActive: '34m Ago',
          description: 'Customer notification dispatch agent paused due to high risk anomaly.',
        },
      ],
    },
    recentEvents: [
      { id: 'ev-1', agent: 'Research-Agent', action: 'Read_Web', decision: 'Allowed', riskScore: 12, timeAgo: '3 hrs ago' },
      { id: 'ev-2', agent: 'Email-Agent', action: 'Send_Email', decision: 'Blocked', riskScore: 87, timeAgo: '6 hrs ago' },
      { id: 'ev-3', agent: 'Ops-Agent', action: 'List_Files', decision: 'Review', riskScore: 68, timeAgo: '1 day ago' },
      { id: 'ev-4', agent: 'Data-Agent', action: 'Query_Db', decision: 'Allowed', riskScore: 24, timeAgo: '2 days ago' },
    ],
    attention: {
      badgeCount: 11,
      items: [
        {
          id: 'review-actions',
          iconType: 'review',
          text: '11 Actions Awaiting Review',
          count: 11,
          severity: 'yellow',
          details: 'Supervisory sign-off required for file system write permissions across Ops-Agent.',
        },
        {
          id: 'paused-agent',
          iconType: 'paused',
          text: '1 Agent Paused',
          count: 1,
          severity: 'orange',
          details: 'Email-Agent auto-paused following anomalous credential spray detection.',
        },
        {
          id: 'high-risk',
          iconType: 'risk',
          text: '42 High-Risk Events (≥ 61)',
          count: 42,
          severity: 'red',
          details: '42 events flagged with elevated heuristic risk this month.',
        },
        {
          id: 'policy-changes',
          iconType: 'policy',
          text: '9 Policy Changes This Month',
          count: 9,
          severity: 'purple',
          details: 'Updated Research v2 sandbox definitions and restricted outbound ports.',
        },
      ],
    },
  },
};
