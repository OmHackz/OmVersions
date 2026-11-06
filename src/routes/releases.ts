import { Hono } from "hono";

export function createApp() {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({
      success: true,
      data: {
        message: "Release routes are mounted under /api/v1/:id/releases",
      },
    });
  });

  return app;
}
