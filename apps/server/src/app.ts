import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { accountController } from "./controllers/account.ts";
import { filesController } from "./controllers/files.ts";
import { healthController } from "./controllers/health.ts";
import { orgsController } from "./controllers/orgs.ts";
import { projectsController } from "./controllers/projects.ts";
import { publicController } from "./controllers/public.ts";
import { projectSharingController, redeemController } from "./controllers/sharing.ts";
import type { AppEnv, Deps } from "./context.ts";
import { errors } from "./lib/errors.ts";
import { onError, rateLimit, requestContext, requireUser, session } from "./middleware/index.ts";

/**
 * Builds the HTTP app. `resolveDeps` runs per request: Node returns one shared instance,
 * Workers opens a request-scoped DB connection that `dispose` closes after the response.
 */
export function createApp(
	resolveDeps: (c: { env: unknown; executionCtx?: unknown }) => { deps: Deps; dispose?: () => void }
) {
	const app = new Hono<AppEnv>();

	app.use("*", async (c, next) => {
		const { deps, dispose } = resolveDeps({ env: c.env, executionCtx: safeExecutionCtx(c) });
		c.set("deps", deps);
		try {
			await next();
		} finally {
			dispose?.();
		}
	});
	app.use("*", requestContext);
	app.use("*", secureHeaders());
	app.use("/api/*", (c, next) =>
		cors({
			origin: c.var.deps.config.webOrigins,
			credentials: true,
			allowHeaders: ["content-type", "if-match", "if-none-match", "authorization"],
			exposeHeaders: ["etag", "x-request-id", "retry-after"],
			allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
			maxAge: 600
		})(c, next)
	);

	app.route("/", healthController);
	// Registered before the session gate below, so these answer without one.
	app.on(["GET", "POST", "PUT", "PATCH", "DELETE"], "/api/auth/*", (c) =>
		c.var.deps.auth.handler(c.req.raw)
	);
	app.route("/api/public", publicController);

	app.use("/api/*", session, requireUser, rateLimit("api"));
	app.route("/api/me", accountController);
	app.route("/api/projects", projectsController);
	app.route("/api/projects", filesController);
	app.route("/api/projects", projectSharingController);
	app.route("/api", redeemController);
	app.route("/api/orgs", orgsController);

	app.notFound((c) => onError(errors.notFound("Route"), c));
	app.onError(onError);
	return app;
}

function safeExecutionCtx(c: { executionCtx: unknown }) {
	try {
		return c.executionCtx;
	} catch {
		return undefined;
	}
}
