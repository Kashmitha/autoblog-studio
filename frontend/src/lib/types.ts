export type Status =
  | "PLANNED"
  | "RESEARCHING"
  | "DRAFTING"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "REJECTED";
export interface Issue {
  code: string;
  severity: "warning" | "error";
  message: string;
  evidence: string;
}
export interface Report {
  id: string;
  passed: boolean;
  score: number;
  version: number;
  issues: Issue[];
  createdAt: string;
}
export interface Source {
  id: string;
  url: string;
  title: string;
  note: string;
  checkedAt: string | null;
  httpStatus: number | null;
}
export interface Media {
  providerPhotoId?: string;
  id: string;
  title: string;
  url: string;
  alt: string;
  creator: string;
  sourceUrl: string;
  profileUrl?: string;
  provider: string;
  license: string;
  licenseUrl: string;
  attribution: string;
  rightsConfirmed: boolean;
  checkedAt: string;
}
export interface Article {
  id: string;
  title: string;
  slug: string;
  niche: string;
  intent: string;
  excerpt: string;
  html: string;
  labels: string[];
  status: Status;
  version: number;
  aiAssisted: boolean;
  approvedAt?: string | null;
  disclosure: boolean;
  canonicalUrl?: string;
  publishedUrl?: string;
  scheduledAt?: string;
  remotePostId?: string;
  publishingTarget?: "local" | "blogger";
  remoteBlogId?: string;
  remoteStatus?: string;
  remoteSyncedAt?: string;
  remoteSyncError?: string;
  draftAttemptedAt?: string;
  bloggerDraftHandoffAt?: string | null;
  updateReminderAt?: string;
  updatedAt: string;
  reports?: Report[];
  sources?: Source[];
  media?: { media: Media }[];
  events?: {
    id: string;
    from: Status;
    to: Status;
    reason: string;
    createdAt: string;
  }[];
  generation?: {
    editorialApproval?: {
      kind: string;
      version: number;
      revision?: number;
      at: string;
    };
    outline?: string[];
    uncertainties?: string[];
    imageSearchTerms?: string[];
  };
}
export interface Job {
  id: string;
  articleId: string;
  mode: string;
  target?: string;
  state: string;
  attempts: number;
  scheduledAt: string;
  finishedAt?: string;
  error?: string;
  article?: { title: string; status: Status };
}
export interface FinanceEntry {
  id: string;
  date: string;
  kind: string;
  category: string;
  amount: string;
  source: string;
  reference: string;
  note: string;
}
export interface Dashboard {
  month: string;
  totalArticles: number;
  counts: Partial<Record<Status, number>>;
  finance: {
    actualRevenue: number;
    estimatedRevenue: number;
    expenses: number;
    aiCost: number;
    netProfit: number;
    rpm: number | null;
    breakEvenRevenue: number;
    currency: string;
    source: string;
  };
  traffic: {
    pageviews: number | null;
    impressions: number | null;
    clicks: number | null;
    ctr: number | null;
    viewSource: string | null;
    searchSource: string | null;
  };
  daily: {
    date: string;
    revenue: number;
    expense: number;
    pageviews: number | null;
  }[];
  recentArticles: Article[];
  entries: FinanceEntry[];
  jobs: Job[];
  hasFinancialRecords: boolean;
  publishingSuccessRate: number | null;
  monthOverMonth: number | null;
  goals: {
    initial: number;
    stretch: number;
    longTerm: number;
    progress: number;
  };
  topArticles: {
    url: string;
    pageviews: number | null;
    clicks: number | null;
    impressions: number | null;
  }[];
}
export interface Settings {
  id: string;
  paused: boolean;
  emergencyStop: boolean;
  dailyLimit: number;
  times: string[];
  timezone: string;
  sitemapUrl?: string;
  sitemapValid: boolean;
}
export interface Integrations {
  google: null | {
    blogId?: string;
    blogUrl?: string;
    accountLabel: string;
    firstLiveTestAuthorizedAt?: string;
    liveTestSucceededAt?: string;
  };
  bloggerMode: string;
  aiEnabled: boolean;
  aiConfigured: boolean;
  aiModel: string;
  aiMonthlyLimit: number;
  googleConfigured: boolean;
  unsplashConfigured: boolean;
  searchConsoleConfigured: boolean;
  searchConsoleSiteUrl?: string | null;
  searchConsoleReadAccess?: boolean;
  analyticsReadAccess?: boolean;
  analyticsConfigured: boolean;
  adsterraConfigured: boolean;
}
export interface IndexingConfiguration {
  siteUrl: string | null;
  configured: boolean;
  readAccess: boolean;
  googleConnected: boolean;
  googleConfigured: boolean;
}
export interface PerformancePeriod {
  pageviews: number | null;
  impressions: number | null;
  clicks: number | null;
  ctr: number | null;
  daysReported: number;
  viewDaysReported: number;
  searchDaysReported: number;
  latestReportedDate: string | null;
}
export interface TrafficSyncAttempt {
  id: string;
  siteUrl: string;
  trigger: "automatic" | "manual";
  state: "RUNNING" | "SUCCEEDED" | "EMPTY" | "FAILED";
  startDate: string;
  endDate: string;
  imported: number;
  startedAt: string;
  finishedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}
export interface TrafficSyncStatus {
  configuration: IndexingConfiguration;
  history: TrafficSyncAttempt[];
  lastSuccess: TrafficSyncAttempt | null;
  lastAttempt: TrafficSyncAttempt | null;
  nextAutomaticSyncAt: string | null;
  note: string;
}
export interface LiveFetchResult {
  outcome:
    "NO_ISSUE_REPRODUCED" | "ISSUE_OBSERVED" | "INCONCLUSIVE" | "REVIEW_NEEDED";
  checkedAt: string;
  url: string;
  scriptsExecuted: false;
  limitation: string;
  profiles: {
    name: string;
    finalUrl: string | null;
    status: number | null;
    error: string | null;
    hops: { url: string; status: number; location: string | null }[];
    findings: { code: string; severity: "issue" | "review"; message: string }[];
    metadata: null | {
      canonicals: string[];
      robots: { agent: string; content: string }[];
      refreshHeader: string | null;
      metaRefresh: string[];
      noindex: boolean;
    };
  }[];
}
export interface FetchDiagnosticRun {
  id: string;
  state: "RUNNING" | "COMPLETED" | "FAILED";
  startedAt: string;
  finishedAt: string | null;
  result: LiveFetchResult | null;
  errorMessage: string | null;
}
export interface FetchDiagnosticReport {
  article: { id: string; title: string; publishedUrl: string | null };
  eligible: boolean;
  canCheck: boolean;
  blockedReason: string | null;
  latest: FetchDiagnosticRun | null;
  history: FetchDiagnosticRun[];
  nextCheckAt: string | null;
  google: {
    state: string;
    coverageState: string | null;
    lastCrawlTime: string | null;
    checkedAt: string;
    inspectionResultLink: string | null;
  } | null;
  cached?: boolean;
}
export interface ArticlePerformanceReport {
  generatedAt: string;
  days: number;
  current: { start: string; end: string };
  previous: { start: string; end: string };
  dateConvention: string;
  note: string;
  totalPublished: number;
  truncated: boolean;
  articles: {
    articleId: string;
    title: string;
    url: string;
    publishedAt: string | null;
    current: PerformancePeriod;
    previous: PerformancePeriod;
    viewSource: string | null;
    searchSource: string | null;
    changes: Record<
      "clicks" | "pageviews" | "impressions",
      { absolute: number; percent: number | null } | null
    >;
  }[];
}
export interface IndexInspection {
  id: string;
  state: "INDEXED" | "NOT_INDEXED" | "UNKNOWN" | "ERROR";
  checkedAt: string;
  lastCrawlTime: string | null;
  coverageState: string | null;
  verdict: string | null;
  pageFetchState: string | null;
  robotsTxtState: string | null;
  indexingState: string | null;
  crawledAs: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  inspectionResultLink: string | null;
  errorCode: string | null;
  errorMessage: string | null;
}
export interface IndexingReport {
  articleId: string;
  title: string;
  publishingStatus: Status;
  url: string | null;
  eligible: boolean;
  canInspect: boolean;
  blockedReason: string | null;
  latest: IndexInspection | null;
  lastAttempt: IndexInspection | null;
  history: IndexInspection[];
  configuration: IndexingConfiguration;
  cached?: boolean;
  followUp?: {
    category:
      "scheduled" | "setup" | "unknown" | "indexed" | "waiting" | "attention";
    title: string;
    action: string;
    sameCrawl: boolean;
  };
  nextAutomaticCheckAt?: string | null;
}
