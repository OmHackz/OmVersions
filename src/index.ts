import { Hono } from "hono";
import { env } from "hono/adapter";
import { createApiRoutes } from "./api";
import { loadProjects } from "../config/loader";
import { projectsJson } from "../../projects.json";
import { errorResponse, isHttpError, HttpError } from "../utils/errors";
import { Env } from "../types";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  const config = loadProjects(projectsJson);

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
    if (err instanceof HttpError) {
      return errorResponse(err.code, err.message, err.status);
    }
    return errorResponse("INTERNAL_ERROR", "An internal server error occurred.", 500);
  });

  app.notFound((c) => {
    return errorResponse("PROJECT_NOT_FOUND", "The requested route was not found.", 404);
  });

  app.route("/api/v1", createApiRoutes(config.projects, env(c)));

  return app;
}
