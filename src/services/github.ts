import { Env, GitHubRelease, Release } from "../types";
import { HttpError, ErrorCodes, jsonResponse } from "../utils/errors";
import { extractVersion, classifyChannel, parseGitHubRepoUrl } from "../utils/validation";
import { compareSemVer, isValidSemVer } from "../utils/versions";

const GITHUB_API = "https://api.github.com";

export interface GitHubServiceOptions {
  token?: string;
  baseUrl?: string;
}

export class GitHubService {
  private readonly token: string | undefined;
  private readonly baseUrl: string;

  constructor(options: GitHubServiceOptions = {}) {
    this.token = options.token;
    this.baseUrl = options.baseUrl ?? GITHUB_API;
  }

  private headers(): HeadersInit {
    const headers: HeadersInit = {
      Accept: "application/vnd.github+json",
      "User-Agent": "OmVersions/1.0 (+https://version.omhackz.top)",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    const response = await fetch(url, {
      headers: this.headers(),
      signal,
    });

    if (response.status === 403) {
      const text = await response.text().catch(() => "");
      if (/rate limit/i.test(text) || response.headers.get("X-RateLimit-Remaining") === "0") {
        throw HttpError.for("GITHUB_RATE_LIMITED");
      }
      throw HttpError.for("UPSTREAM_ERROR");
    }

    if (response.status === 404) {
      throw HttpError.for("UPSTREAM_ERROR");
    }

    if (!response.ok) {
      throw HttpError.for("UPSTREAM_ERROR");
    }

    return (await response.json()) as T;
  }

  async listReleases(owner: string, repo: string, signal?: AbortSignal): Promise<GitHubRelease[]> {
    const releases: GitHubRelease[] = [];
    let page = 1;

    while (true) {
      const batch = await this.fetchJson<GitHubRelease[]>(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases?per_page=100&page=${page}`,
        signal,
      );

      if (!Array.isArray(batch) || batch.length === 0) {
        break;
      }

      releases.push(...batch);

      if (batch.length < 100) {
        break;
      }

      page++;
    }

    return releases;
  }

  async getReleases(owner: string, repo: string, signal?: AbortSignal): Promise<Release[]> {
    const raw = await this.listReleases(owner, repo, signal);

    const releases = raw
      .filter((r) => !r.draft)
      .map((r) => this.mapRelease(owner, repo, r));

    return releases;
  }

  private mapRelease(owner: string, repo: string, r: GitHubRelease): Release {
    const tag = r.tag_name;
    const version = extractVersion(tag);
    const channel = classifyChannel(tag);
    const repository = `${owner}/${repo}`;

    return {
      id: String(r.id),
      repository,
      version,
      tag,
      channel,
      prerelease: Boolean(r.prerelease),
      publishedAt: r.published_at ?? null,
      changelog: r.body ?? "",
      releaseUrl: r.html_url,
      assets: r.assets.map((a) => ({
        name: a.name,
        size: a.size,
        contentType: a.content_type,
        downloadUrl: a.browser_download_url,
        downloadCount: a.download_count,
      })),
    };
  }

  async latestRelease(
    owner: string,
    repo: string,
    channel: string,
    signal?: AbortSignal,
  ): Promise<Release | null> {
    const releases = await this.getReleases(owner, repo, signal);

    if (releases.length === 0) {
      return null;
    }

    const candidates = releases.filter((r) => {
      if (channel === "stable") {
        return !r.prerelease;
      }
      return r.channel === channel;
    });

    if (candidates.length === 0) {
      return null;
    }

    // Sort newest first by published date, fall back to semver order.
    candidates.sort((a, b) => {
      const pa = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const pb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      if (pb !== pa) return pb - pa;
      try {
        return compareSemVer(b.version, a.version);
      } catch {
        return 0;
      }
    });

    return candidates[0];
  }

  async findReleaseByTag(
    owner: string,
    repo: string,
    tag: string,
    signal?: AbortSignal,
  ): Promise<Release | null> {
    const releases = await this.getReleases(owner, repo, signal);
    return releases.find((r) => r.tag === tag) ?? null;
  }
}

export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("request timeout")), ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

export function createGitHubService(env: Env): GitHubService {
  return new GitHubService({ token: env.GITHUB_TOKEN });
}
