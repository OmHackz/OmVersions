import { Hono } from "hono";
import { env } from "hono/adapter";
import { Env, ProjectConfig, Release } from "./types";
import { loadProjects, findProject, repoFromConfig } from "./config/loader";
import { jsonResponse, errorResponse, HttpError, isHttpError } from "./utils/errors";
import { ReleaseService } from "./services/releases";
import { createGitHubService } from "./services/github";
import { createCacheService } from "./services/cache";
import projectsConfig from "../projects.json";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  const config = loadProjects(projectsConfig);

  app.use("*", async (c, next) => {
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-Frame-Options", "DENY");
    c.header("Referrer-Policy", "no-referrer");
    c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    await next();
  });

  app.options("*", (c) => {
    return c.body(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
      },
    });
  });

  app.use("GET /api/*", async (c, next) => {
    await next();
    const response = c.res;
    if (response.ok) {
      response.headers.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    }
  });

  app.onError((err, c) => {
    if (isHttpError(err)) {
      return errorResponse(err.code, err.message, err.status);
    }
    return errorResponse("INTERNAL_ERROR", "An internal server error occurred.", 500);
  });

  app.notFound((c) => {
    return errorResponse("PROJECT_NOT_FOUND", "The requested route was not found.", 404);
  });

  app.get("/", (c) => {
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

  app.get("/health", (c) => {
    return jsonResponse({
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get("/api/v1", (c) => {
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

  app.get("/api/v1/projects", (c) => {
    const bindings = env(c) as unknown as Env;
    const list = config.projects.map((p: ProjectConfig) => ({
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

  app.get("/api/v1/stats", (c) => {
    const bindings = env(c) as unknown as Env;
    const stats = {
      projects: config.projects.length,
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
        defaultTtlSeconds: defaultTtl(bindings),
        note: "Cloudflare Workers Cache API is not globally replicated between all data centers. Cache hits are local to the data center that served the request.",
      },
    };

    return jsonResponse({
      success: true,
      data: stats,
    });
  });

  app.get("/api/v1/:id", async (c) => {
    const id = c.req.param("id");
    const project = findProject(config.projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const bindings = env(c) as unknown as Env;
    const service = new ReleaseService(
      bindings,
      createGitHubService(bindings.GITHUB_TOKEN),
      createCacheService(bindings),
    );

    try {
      const { owner, repo } = repoFromConfig(project);
      const latest = await service.latestRelease(project.id, owner, repo, "stable");

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

  app.get("/api/v1/:id/latest", async (c) => {
    const id = c.req.param("id");
    const project = findProject(config.projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const bindings = env(c) as unknown as Env;
    const channel = c.req.query("channel") ?? "stable";
    const service = new ReleaseService(
      bindings,
      createGitHubService(bindings.GITHUB_TOKEN),
      createCacheService(bindings),
    );
    const { owner, repo } = repoFromConfig(project);
    const release = await service.latestRelease(project.id, owner, repo, channel);

    return jsonResponse({
      success: true,
      data: release,
      meta: { source: "github", cached: false },
    });
  });

  app.get("/api/v1/:id/releases", async (c) => {
    const id = c.req.param("id");
    const project = findProject(config.projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const bindings = env(c) as unknown as Env;
    const channel = c.req.query("channel");
    const service = new ReleaseService(
      bindings,
      createGitHubService(bindings.GITHUB_TOKEN),
      createCacheService(bindings),
    );
    const { owner, repo } = repoFromConfig(project);
    const releases = await service.listReleases(project.id, owner, repo);

    const filtered = channel ? releases.filter((r: Release) => r.channel === channel) : releases;

    return jsonResponse({
      success: true,
      data: { releases: filtered, count: filtered.length },
      meta: { source: "github", cached: false },
    });
  });

  app.get("/api/v1/:id/releases/:tag", async (c) => {
    const id = c.req.param("id");
    const project = findProject(config.projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const bindings = env(c) as unknown as Env;
    const tag = c.req.param("tag");
    const service = new ReleaseService(
      bindings,
      createGitHubService(bindings.GITHUB_TOKEN),
      createCacheService(bindings),
    );
    const { owner, repo } = repoFromConfig(project);
    const release = await service.releaseByTag(project.id, owner, repo, tag);

    return jsonResponse({
      success: true,
      data: release,
      meta: { source: "github", cached: false },
    });
  });

  app.get("/api/v1/:id/changelog", async (c) => {
    const id = c.req.param("id");
    const project = findProject(config.projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const bindings = env(c) as unknown as Env;
    const channel = c.req.query("channel") ?? "stable";
    const service = new ReleaseService(
      bindings,
      createGitHubService(bindings.GITHUB_TOKEN),
      createCacheService(bindings),
    );
    const { owner, repo } = repoFromConfig(project);
    const release = await service.latestRelease(project.id, owner, repo, channel);

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

  app.get("/api/v1/:id/assets", async (c) => {
    const id = c.req.param("id");
    const project = findProject(config.projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const bindings = env(c) as unknown as Env;
    const channel = c.req.query("channel") ?? "stable";
    const service = new ReleaseService(
      bindings,
      createGitHubService(bindings.GITHUB_TOKEN),
      createCacheService(bindings),
    );
    const { owner, repo } = repoFromConfig(project);
    const release = await service.latestRelease(project.id, owner, repo, channel);

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

  app.get("/api/v1/:id/check", async (c) => {
    const id = c.req.param("id");
    const project = findProject(config.projects, id);

    if (!project) {
      throw HttpError.for("PROJECT_NOT_FOUND");
    }

    const bindings = env(c) as unknown as Env;
    const current = c.req.query("current");
    const channel = c.req.query("channel") ?? "stable";

    if (!current) {
      return errorResponse("INVALID_VERSION", "The 'current' query parameter is required.", 400);
    }

    const service = new ReleaseService(
      bindings,
      createGitHubService(bindings.GITHUB_TOKEN),
      createCacheService(bindings),
    );
    const { owner, repo } = repoFromConfig(project);
    const result = await service.checkUpdate(project.id, owner, repo, current, channel);

    return jsonResponse({
      success: true,
      data: result,
    });
  });

  return app;
}

function defaultTtl(env: { RELEASE_CACHE_TTL?: string }): number {
  const raw = env.RELEASE_CACHE_TTL;
  if (!raw) return 300;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300;
}

export default createApp();
