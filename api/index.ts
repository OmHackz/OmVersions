import { createApp } from "../src/index";
import { handle } from "@hono/vercel";

export const runtime = "edge";

const app = createApp();

export default handle(app);
