import { describe, it, expect } from "vitest";
import { createApp } from "../src/index";
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

describe("API routes", () => {
  it("lists projects", async () => {
    const app = createApp();
    const res = await app.request("/api/v1/projects", {
      bindings: { GITHUB_TOKEN: undefined, RELEASE_CACHE_TTL: "300" } as any,
    } as any);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { projects: any[]; count: number } };
    expect(json.success).toBe(true);
    expect(json.data.projects.length).toBe(4);
  });

  it("returns API metadata", async () => {
    const app = createApp();
    const res = await app.request("/api/v1", {
      bindings: { GITHUB_TOKEN: undefined, RELEASE_CACHE_TTL: "300" } as any,
    } as any);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean };
    expect(json.success).toBe(true);
  });

  it("returns health", async () => {
    const app = createApp();
    const res = await app.request("/health", {
      bindings: { GITHUB_TOKEN: undefined, RELEASE_CACHE_TTL: "300" } as any,
    } as any);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { success: boolean; data: { status: string } };
    expect(json.success).toBe(true);
    expect(json.data.status).toBe("ok");
  });

  it("check update rejects invalid version", async () => {
    const service = new ReleaseService(
      {} as any,
      new GitHubService(),
      new MemoryCache(),
    );
    await expect(service.checkUpdate("p", "o", "r", "not-semver", "stable")).rejects.toBeInstanceOf(
      HttpError,
    );
  });

  it("check update detects newer version", async () => {
    const service = new ReleaseService(
      {} as any,
      new GitHubService(),
      new MemoryCache(),
    );
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
});
