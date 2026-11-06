export interface ProjectConfig {
  id: string;
  repo: string;
  displayName?: string;
  description?: string;
  website?: string;
}

export interface ParsedRepo {
  owner: string;
  repo: string;
}

export interface GitHubAsset {
  name: string;
  size: number;
  content_type: string;
  browser_download_url: string;
  download_count: number;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  published_at: string | null;
  html_url: string;
  assets: GitHubAsset[];
  prerelease: boolean;
  draft: boolean;
}

export interface Asset {
  name: string;
  size: number;
  contentType: string;
  downloadUrl: string;
  downloadCount: number;
}

export interface Release {
  id: string;
  repository: string;
  version: string;
  tag: string;
  channel: string;
  prerelease: boolean;
  publishedAt: string | null;
  changelog: string;
  releaseUrl: string;
  assets: Asset[];
}

export interface LatestReleaseResponse {
  id: string;
  repository: string;
  version: string;
  tag: string;
  channel: string;
  prerelease: boolean;
  publishedAt: string | null;
  changelog: string;
  releaseUrl: string;
  assets: Asset[];
}

export interface ChannelInfo {
  name: string;
  regex: RegExp;
}

export interface CheckResult {
  project: string;
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string | null;
}

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface ApiResponse<T> {
  success: true;
  data: T;
  meta?: {
    source: string;
    cached: boolean;
  };
}

export interface ProjectsListItem {
  id: string;
  repository: string;
  displayName?: string;
  description?: string;
  website?: string;
}

export interface StatsResponse {
  projects: number;
  endpoints: string[];
  cache: {
    defaultTtlSeconds: number;
    note: string;
  };
}

export interface Env {
  GITHUB_TOKEN?: string;
  RELEASE_CACHE_TTL?: string;
  ASSETS?: unknown;
}
