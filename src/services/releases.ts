import { Env, Release, LatestReleaseResponse } from "../types";
import { HttpError, jsonResponse } from "../utils/errors";
import { isValidSemVer, compareSemVer } from "../utils/versions";
import { GitHubService, withTimeout } from "./github";
import { CacheService, cacheKey, defaultTtl } from "./cache";

const REQUEST_TIMEOUT_MS = 15000;

interface CachedJson<T> {
  data: T;
  cached: boolean;
}

export class ReleaseService {
  private readonly github: GitHubService;
  private readonly cache: CacheService;
  private readonly ttl: number;

  constructor(env: Env, github: GitHubService, cache: CacheService) {
    this.github = github;
    this.cache = cache;
    this.ttl = defaultTtl(env);
  }

  async listReleases(projectId: string, owner: string, repo: string): Promise<Release[]> {
    const key = cacheKey(projectId, "releases");
    const cached = await this.cache.get(key);

    if (cached) {
      try {
        const body = (await cached.json()) as CachedJson<Release[]>;
        return body.data;
      } catch {
        // fall through to fetch
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const releases = await withTimeout(
        this.github.getReleases(owner, repo, controller.signal),
        REQUEST_TIMEOUT_MS,
      );

      const response = jsonResponse(
        { success: true, data: { releases }, meta: { source: "github", cached: false } },
      );
      await this.cache.put(key, response, this.ttl);

      return releases;
    } finally {
      clearTimeout(timeout);
    }
  }

  async latestRelease(
    projectId: string,
    owner: string,
    repo: string,
    channel: string,
  ): Promise<LatestReleaseResponse> {
    const key = cacheKey(projectId, `latest:${channel}`);
    const cached = await this.cache.get(key);

    if (cached) {
      try {
        const body = (await cached.json()) as CachedJson<LatestReleaseResponse>;
        return body.data;
      } catch {
        // fall through to fetch
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const release = await withTimeout(
        this.github.latestRelease(owner, repo, channel, controller.signal),
        REQUEST_TIMEOUT_MS,
      );

      if (!release) {
        throw HttpError.for("NO_RELEASES");
      }

      const view: LatestReleaseResponse = {
        id: release.id,
        repository: release.repository,
        version: release.version,
        tag: release.tag,
        channel: release.channel,
        prerelease: release.prerelease,
        publishedAt: release.publishedAt,
        changelog: release.changelog,
        releaseUrl: release.releaseUrl,
        assets: release.assets,
      };

      const response = jsonResponse(
        { success: true, data: view, meta: { source: "github", cached: false } },
      );
      await this.cache.put(key, response, this.ttl);

      return view;
    } finally {
      clearTimeout(timeout);
    }
  }

  async releaseByTag(projectId: string, owner: string, repo: string, tag: string): Promise<Release> {
    const key = cacheKey(projectId, `tag:${tag}`);
    const cached = await this.cache.get(key);

    if (cached) {
      try {
        const body = (await cached.json()) as CachedJson<Release>;
        return body.data;
      } catch {
        // fall through to fetch
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const release = await withTimeout(
        this.github.findReleaseByTag(owner, repo, tag, controller.signal),
        REQUEST_TIMEOUT_MS,
      );

      if (!release) {
        throw HttpError.for("RELEASE_NOT_FOUND");
      }

      const response = jsonResponse(
        { success: true, data: { release }, meta: { source: "github", cached: false } },
      );
      await this.cache.put(key, response, this.ttl);

      return release;
    } finally {
      clearTimeout(timeout);
    }
  }

  async checkUpdate(
    projectId: string,
    owner: string,
    repo: string,
    current: string,
    channel: string,
  ): Promise<{
    project: string;
    currentVersion: string;
    latestVersion: string;
    updateAvailable: boolean;
    releaseUrl: string | null;
  }> {
    if (!isValidSemVer(current)) {
      throw HttpError.for("INVALID_VERSION");
    }

    const latest = await this.latestRelease(projectId, owner, repo, channel);

    let updateAvailable = false;
    try {
      updateAvailable = compareSemVer(latest.version, current) > 0;
    } catch {
      updateAvailable = false;
    }

    return {
      project: projectId,
      currentVersion: current,
      latestVersion: latest.version,
      updateAvailable,
      releaseUrl: latest.releaseUrl,
    };
  }
}
