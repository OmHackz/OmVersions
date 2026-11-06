import { Hono } from "hono";
import { Env } from "../types";
import { loadProjects, findProject } from "../config/loader";
import { jsonResponse, errorResponse, isHttpError, HttpError } from "../utils/errors";
import { ReleaseService } from "../services/releases";
import { createGitHubService } from "../services/github";
import { createCacheService } from "../services/cache";

type ProjectConfig = NonNullable<ReturnType<typeof loadProjects>>["projects"][number];

export function createApiRoutes(projects: ProjectConfig[], env: Env) {
  const route = new Hono<{ Bindings: Env }>();

  const github = createGitHubService(env);
  const cache = createCacheService(env);

  route.get("/", (c) => {
    return jsonResponse({
      success: true,
      data: {
        name: "OmVersions",
        description: "Centralized version management API for GitHub releases.",
        version: "1.0.0",
        baseUrl: "https://version.omhackz.top/api/v1",
        documentation: "https://version.omhackz.top/docs",
        repository: "https://github.com/OmHackz-dev/OmVersions",
      },
    });
  });

  route.get("/health", (c) => {
    return jsonResponse({
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    });
  });

  route.get("/api/v1", (c) => {
    return jsonResponse({
      success: true,
      data: {
        name: "OmVersions API",
        version: "1.0.0",
        baseUrl: "https://version.omhackz.top/api/v1",
        endpoints: {
          projects: "/api/v1/projects",
          stats: "/api/v1/stats",
          project: "/api/v1/:id",
          latest: "/api/v1/:id/latest",
          releases: "/api/v1/:id/releases",
          release: "/api/v1/:id/releases/:tag",
          changelog: "/api/v1/:id/changelog",
          assets: "/api/v1/:id/assets",
          check: "/api/v1/:id/check",
        },
      },
    });
  });

  route.get("/api/v1/projects", (c) => {
    const list = projects.map((p) => ({
      id: p.id,
      repository: p.repo,
      displayName: p.displayName,
      description: p.description,
      website: p.website,
    }));

    return jsonResponse({
      success: true,
      data: { projects: list, count: list.length },
    });
  });

  route.get("/api/v1/stats", (c) => {
    const stats = {
      projects: projects.length,
      endpoints: [
        "/api/v1",
        "/api/v1/projects",
        "/api/v1/stats",
        "/api/v1/:id",
        "/api/v1/:id/latest",
        "/api/v1/:id/releases",
        "/api/v1/:id/releases/:tag",
        "/api/v1/:id/changelog",
        "/api/v1/:id/assets",
        "/api/v1/:id/check",
      ],
      cache: {
        defaultTtlSeconds: (() => {
          const raw = env.RELEASE_CACHE_TTL;
          if (!raw) return 300;
          const parsed = parseInt(raw, 10);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
        })(),
        note: "Cloudflare Workers Cache API is not globally replicated between all data centers. Cache hits are local to the data center that served the request.",
      },
    };

    return jsonResponse({
      success: true,
      data: stats,
    });
  });

  route.get("/api/v1/:id", async (c) => {
    const id = c.req.param("id");
    const project = findProject(projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const service = new ReleaseService(env, github, cache);

    try {
      const latest = await service.latestRelease(project.id, repoOwner(project), repoName(project), "stable");

      return jsonResponse({
        success: true,
        data: {
          id: project.id,
          repository: project.repo,
          displayName: project.displayName,
          description: project.description,
          website: project.website,
          latest,
        },
        meta: { source: "github", cached: false },
      });
    } catch (error) {
      if (isHttpError(error) && error.code === "NO_RELEASES") {
        return jsonResponse({
          success: true,
          data: {
            id: project.id,
            repository: project.repo,
            displayName: project.displayName,
            description: project.description,
            website: project.website,
            latest: null,
          },
          meta: { source: "github", cached: false },
        });
      }
      throw error;
    }
  });

  route.get("/api/v1/:id/latest", async (c) => {
    const id = c.req.param("id");
    const project = findProject(projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const channel = c.req.query("channel") ?? "stable";
    const service = new ReleaseService(env, github, cache);
    const release = await service.latestRelease(project.id, repoOwner(project), repoName(project), channel);

    return jsonResponse({
      success: true,
      data: release,
      meta: { source: "github", cached: false },
    });
  });

  route.get("/api/v1/:id/releases", async (c) => {
    const id = c.req.param("id");
    const project = findProject(projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const channel = c.req.query("channel");
    const service = new ReleaseService(env, github, cache);
    const releases = await service.listReleases(project.id, repoOwner(project), repoName(project));

    const filtered = channel ? releases.filter((r) => r.channel === channel) : releases;

    return jsonResponse({
      success: true,
      data: { releases: filtered, count: filtered.length },
      meta: { source: "github", cached: false },
    });
  });

  route.get("/api/v1/:id/releases/:tag", async (c) => {
    const id = c.req.param("id");
    const tag = c.req.param("tag");
    const project = findProject(projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const service = new ReleaseService(env, github, cache);
    const release = await service.releaseByTag(project.id, repoOwner(project), repoName(project), tag);

    return jsonResponse({
      success: true,
      data: release,
      meta: { source: "github", cached: false },
    });
  });

  route.get("/api/v1/:id/changelog", async (c) => {
    const id = c.req.param("id");
    const project = findProject(projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const channel = c.req.query("channel") ?? "stable";
    const service = new ReleaseService(env, github, cache);
    const release = await service.latestRelease(project.id, repoOwner(project), repoName(project), channel);

    return jsonResponse({
      success: true,
      data: {
        id: project.id,
        version: release.version,
        tag: release.tag,
        channel: release.channel,
        changelog: release.changelog,
        releaseUrl: release.releaseUrl,
        publishedAt: release.publishedAt,
      },
      meta: { source: "github", cached: false },
    });
  });

  route.get("/api/v1/:id/assets", async (c) => {
    const id = c.req.param("id");
    const project = findProject(projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const channel = c.req.query("channel") ?? "stable";
    const service = new ReleaseService(env, github, cache);
    const release = await service.latestRelease(project.id, repoOwner(project), repoName(project), channel);

    return jsonResponse({
      success: true,
      data: {
        id: project.id,
        version: release.version,
        tag: release.tag,
        channel: release.channel,
        assets: release.assets,
      },
      meta: { source: "github", cached: false },
    });
  });

  route.get("/api/v1/:id/check", async (c) => {
    const id = c.req.param("id");
    const project = findProject(projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const current = c.req.query("current");
    const channel = c.req.query("channel") ?? "stable";

    if (!current) {
      return errorResponse("INVALID_VERSION", "The 'current' query parameter is required.", 400);
    }

    const service = new ReleaseService(env, github, cache);
    const result = await service.checkUpdate(project.id, repoOwner(project), repoName(project), current, channel);

    return jsonResponse({
      success: true,
      data: result,
    });
  });

  function repoOwner(project: { repo: string }): string {
    return new URL(project.repo).pathname.replace(/\/+$/, "").replace(/^\//, "").split("/")[0];
  }

  function repoName(project: { repo: string }): string {
    return new URL(project.repo).pathname.replace(/\/+$/, "").replace(/^\//, "").split("/")[1].replace(/\.git$/i, "");
  }

  return route;
}
