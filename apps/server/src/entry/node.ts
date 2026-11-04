import { serve } from "@hono/node-server";
import { createApp } from "../app.ts";
import { onShutdown } from "./lifecycle.ts";
import { buildNodeDeps } from "./node-deps.ts";

const { deps, close } = await buildNodeDeps();
const app = createApp(() => ({ deps }));
const port = Number(process.env.PORT ?? 8787);

const server = serve({ fetch: app.fetch, port }, (info) =>
	deps.logger.info("server listening", { port: info.port })
);
server.on("error", async (error: NodeJS.ErrnoException) => {
	if (error.code === "EADDRINUSE") {
		console.error(`Port ${port} is already in use. Stop the other server or set PORT.`);
	} else {
		console.error(error);
	}
	await close();
	process.exit(1);
});

onShutdown(async (reason) => {
	deps.logger.info("shutting down", { reason });
	// Keep-alive sockets would hold close() open until they time out.
	await new Promise<void>((resolve) => {
		server.close(() => resolve());
		if ("closeAllConnections" in server) server.closeAllConnections();
	});
	await close();
});
