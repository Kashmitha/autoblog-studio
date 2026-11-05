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
}
