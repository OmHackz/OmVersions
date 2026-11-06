import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GitHubService } from "../src/services/github";
import { HttpError } from "../src/utils/errors";

const RELEASES = [
  {
    id: 1,
    tag_name: "v1.0.0",
    name: "v1.0.0",
    body: "Initial release.",
    published_at: "2026-01-01T00:00:00Z",
    html_url: "https://github.com/o/r/releases/tag/v1.0.0",
    assets: [
      {
        name: "app.zip",
        size: 1000,
        content_type: "application/zip",
        browser_download_url: "https://github.com/o/r/releases/download/v1.0.0/app.zip",
        download_count: 42,
      },
    ],
    prerelease: false,
    draft: false,
  },
  {
    id: 2,
    tag_name: "v1.1.0-beta.1",
    name: "v1.1.0-beta.1",
    body: "Beta.",
    published_at: "2026-02-01T00:00:00Z",
    html_url: "https://github.com/o/r/releases/tag/v1.1.0-beta.1",
    assets: [],
    prerelease: true,
    draft: false,
  },
  {
    id: 3,
    tag_name: "v1.2.0-rc.1",
    name: "v1.2.0-rc.1",
    body: "RC.",
    published_at: "2026-03-01T00:00:00Z",
    html_url: "https://github.com/o/r/releases/tag/v1.2.0-rc.1",
    assets: [],
    prerelease: true,
    draft: true,
  },
];

const originalFetch = globalThis.fetch;

function mockFetch(response: Response) {
  (globalThis as any).fetch = vi.fn(async () => response);
}

function mockJson(body: unknown, status = 200) {
  mockFetch(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
  mockJson(RELEASES);
});

afterEach(() => {
  (globalThis as any).fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("GitHubService", () => {
  it("lists non-draft releases", async () => {
    const svc = new GitHubService();
    const releases = await svc.getReleases("o", "r");
    expect(releases.length).toBe(2);
    expect(releases[0].version).toBe("1.0.0");
    expect(releases[1].version).toBe("1.1.0-beta.1");
  });

  it("classifies channels correctly", async () => {
    const svc = new GitHubService();
    const releases = await svc.getReleases("o", "r");
    const stable = releases.find((r) => r.channel === "stable");
    const beta = releases.find((r) => r.channel === "beta");
    expect(stable?.tag).toBe("v1.0.0");
    expect(beta?.tag).toBe("v1.1.0-beta.1");
  });

  it("returns latest stable", async () => {
    const svc = new GitHubService();
    const latest = await svc.latestRelease("o", "r", "stable");
    expect(latest?.version).toBe("1.0.0");
  });

  it("returns latest beta", async () => {
    const svc = new GitHubService();
    const latest = await svc.latestRelease("o", "r", "beta");
    expect(latest?.version).toBe("1.1.0-beta.1");
  });

  it("returns null for no releases", async () => {
    mockJson([]);
    const svc = new GitHubService();
    const latest = await svc.latestRelease("o", "r", "stable");
    expect(latest).toBeNull();
  });

  it("throws GITHUB_RATE_LIMITED on 403", async () => {
    mockFetch(
      new Response("Rate limited", {
        status: 403,
        headers: { "X-RateLimit-Remaining": "0" },
      }),
    );
    const svc = new GitHubService();
    await expect(svc.getReleases("o", "r")).rejects.toBeInstanceOf(HttpError);
  });

  it("maps assets with original download URLs", async () => {
    const svc = new GitHubService();
    const releases = await svc.getReleases("o", "r");
    const asset = releases[0].assets[0];
    expect(asset?.downloadUrl).toBe("https://github.com/o/r/releases/download/v1.0.0/app.zip");
    expect(asset?.downloadCount).toBe(42);
    expect(asset?.contentType).toBe("application/zip");
  });
});
