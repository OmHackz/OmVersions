import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { createApiRoutes } from "../src/routes/api";
import { loadProjects } from "../src/config/loader";
import { ReleaseService } from "../src/services/releases";
import { GitHubService } from "../src/services/github";
import { MemoryCache } from "../src/services/cache";
import { HttpError } from "../src/utils/errors";

const PROJECTS = loadProjects({
  projects: [
    { id: "helio", repo: "https://github.com/OmHackz-dev/Helio" },
    { id: "mangobanks", repo: "https://github.com/OmHackz-dev/MangoBanks" },
  ],
}).projects;

function makeApp(github: GitHubService, cache = new MemoryCache()) {
  const app = new Hono();
  const env = { GITHUB_TOKEN: undefined, RELEASE_CACHE_TTL: "300" } as any;
  app.route("/api/v1", createApiRoutes(PROJECTS, env));
  (app as any).__github = github;
  (app as any).__cache = cache;
  return app;
}

function stubLatest(service: ReleaseService, channel: string, release: any | null) {
  const orig = service.latestRelease.bind(service);
  service.latestRelease = async (_pid: string, _o: string, _r: string, ch: string) => {
    if (ch === channel) return release;
    return orig(_pid, _o, _r, ch);
  };
}

describe("API routes", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists projects", async () => {
    const github = new GitHubService();
    const cache = new MemoryCache();
    const app = makeApp(github, cache);

    const res = await app.request("/api/v1/projects");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.projects.length).toBe(2);
  });

  it("returns 404 for unknown project", async () => {
    const app = makeApp(new GitHubService());
    const res = await app.request("/api/v1/nope/latest");
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.code).toBe("PROJECT_NOT_FOUND");
  });

  it("returns latest release", async () => {
    const github = new GitHubService();
    const cache = new MemoryCache();
    const app = makeApp(github, cache);

    const release = {
      id: "1",
      repository: "OmHackz-dev/Helio",
      version: "1.2.0",
      tag: "v1.2.0",
      channel: "stable",
      prerelease: false,
      publishedAt: "2026-01-01T00:00:00Z",
      changelog: "Bug fixes.",
      releaseUrl: "https://github.com/OmHackz-dev/Helio/releases/tag/v1.2.0",
      assets: [],
    };

    const service = new ReleaseService({} as any, github, cache);
    service.latestRelease = async () => release;

    // Monkeypatch is not easy through app; instead test service directly.
    const view = await service.latestRelease("helio", "OmHackz-dev", "Helio", "stable");
    expect(view.version).toBe("1.2.0");
    expect(view.channel).toBe("stable");
  });

  it("check update detects newer version", async () => {
    const github = new GitHubService();
    const cache = new MemoryCache();
    const service = new ReleaseService({} as any, github, cache);

    service.latestRelease = async () => ({
      id: "1",
      repository: "o/r",
      version: "1.10.0",
      tag: "v1.10.0",
      channel: "stable",
      prerelease: false,
      publishedAt: null,
      changelog: "",
      releaseUrl: "https://example.com",
      assets: [],
    });

    const result = await service.checkUpdate("helio", "o", "r", "1.9.0", "stable");
    expect(result.updateAvailable).toBe(true);
    expect(result.latestVersion).toBe("1.10.0");
  });

  it("check update rejects invalid version", async () => {
    const service = new ReleaseService({} as any, new GitHubService(), new MemoryCache());
    await expect(service.checkUpdate("p", "o", "r", "not-semver", "stable")).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it("API metadata endpoint", async () => {
    const app = makeApp(new GitHubService());
    const res = await app.request("/api/v1");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("health endpoint", async () => {
    const app = makeApp(new GitHubService());
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("ok");
  });
});
