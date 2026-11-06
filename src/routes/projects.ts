import { Hono } from "hono";

export function createApp() {
  const app = new Hono();

  app.get("/", (c) => {
    return c.json({
      success: true,
      data: {
        message: "Projects are configured through projects.json and exposed under /api/v1/:id",
      },
    });
  });

  return app;
}
