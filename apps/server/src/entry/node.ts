import { serve } from "@hono/node-server";
import { createApp } from "../app.ts";
import { buildNodeDeps } from "./node-deps.ts";

const { deps, close } = await buildNodeDeps();
const app = createApp(() => ({ deps }));
const port = Number(process.env.PORT ?? 8787);

const server = serve({ fetch: app.fetch, port }, (info) =>
	deps.logger.info("server listening", { port: info.port })
);

async function shutdown(signal: string) {
	deps.logger.info("shutting down", { signal });
	server.close();
	await close();
	process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
