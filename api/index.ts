import { Hono } from "hono";
import { createApp } from "../src/index";
import { handle } from "@hono/vercel";
import { readFileSync } from "fs";
import { join } from "path";

const mainApp = createApp();

const app = new Hono();

// Static file serving (served by this function so Vercel routing always works)
const staticFiles: Record<string, { file: string; contentType: string }> = {
  "/": { file: "public/index.html", contentType: "text/html; charset=utf-8" },
  "/docs": { file: "public/docs.html", contentType: "text/html; charset=utf-8" },
  "/style.css": { file: "public/style.css", contentType: "text/css; charset=utf-8" },
  "/script.js": { file: "public/script.js", contentType: "application/javascript; charset=utf-8" },
};

for (const [route, file] of Object.entries(staticFiles)) {
  app.get(route, (c) => {
    try {
      const content = readFileSync(join(process.cwd(), file.file), "utf-8");
      return c.body(content, { headers: { "Content-Type": file.contentType } });
    } catch {
      return c.json({ error: "Not found" }, 404);
    }
  });
}

// Mount main app for all API routes
app.route("/", mainApp);

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
export const OPTIONS = handle(app);
export const HEAD = handle(app);
