import type { Context, MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context.ts";
import { AppError, errors } from "../lib/errors.ts";
import { authorizeProject } from "../rbac/authorize.ts";
import type { OrgPermission } from "../rbac/org.ts";
import type { ProjectPermission } from "../rbac/permissions.ts";
import { projectRepository } from "../repositories/projects.ts";
import { authorizeOrg } from "../services/orgs.ts";

export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
	const requestId = c.req.header("cf-ray") ?? c.req.header("x-request-id") ?? crypto.randomUUID();
	c.set("requestId", requestId);
	c.set("log", c.var.deps.logger.child({ requestId }));
	c.header("x-request-id", requestId);
	await next();
});

export const session = createMiddleware<AppEnv>(async (c, next) => {
	const result = await c.var.deps.auth.api.getSession({ headers: c.req.raw.headers });
	c.set("user", result?.user ?? null);
	c.set("session", result?.session ?? null);
	await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
	if (!c.var.user) throw errors.unauthorized();
	await next();
});

export function currentUser(c: Context<AppEnv>) {
	const user = c.var.user;
	if (!user) throw errors.unauthorized();
	return user;
}

/** Only the operator-configured header is trusted; anything else a client could spoof. */
const clientKey = (c: Context<AppEnv>) =>
	c.var.user?.id ?? c.req.header(c.var.deps.config.clientIpHeader)?.split(",")[0]?.trim() ?? "anon";

export const rateLimit = (policy: "api" | "share") =>
	createMiddleware<AppEnv>(async (c, next) => {
		const { allowed, retryAfterSeconds } = await c.var.deps.adapters.rateLimiter.check(
			policy,
			clientKey(c)
		);
		if (!allowed) {
			c.header("retry-after", String(retryAfterSeconds));
			throw errors.tooManyRequests(retryAfterSeconds);
		}
		await next();
	});

/** Marks guard middleware so the route-coverage test can prove every project route has one. */
export const PROJECT_GUARD = Symbol("projectGuard");

export function requireProject(permission: ProjectPermission): MiddlewareHandler<AppEnv> {
	const guard = createMiddleware<AppEnv>(async (c, next) => {
		const user = currentUser(c);
		const projectId = c.req.param("projectId");
		if (!projectId) throw errors.notFound("Project");
		c.set(
			"access",
			await authorizeProject(projectRepository(c.var.deps.db), user.id, projectId, permission)
		);
		await next();
	});
	return Object.assign(guard, { [PROJECT_GUARD]: permission });
}

/** Marks org guards for the same route-coverage test as project guards. */
export const ORG_GUARD = Symbol("orgGuard");

export function requireOrg(permission: OrgPermission): MiddlewareHandler<AppEnv> {
	const guard = createMiddleware<AppEnv>(async (c, next) => {
		const user = currentUser(c);
		const orgId = c.req.param("orgId");
		if (!orgId) throw errors.notFound("Organization");
		c.set("orgAccess", await authorizeOrg(c.var.deps, user.id, orgId, permission));
		await next();
	});
	return Object.assign(guard, { [ORG_GUARD]: permission });
}

/** RFC 9457 problem details; unknown errors are logged and hidden behind a generic 500. */
export function onError(error: Error, c: Context<AppEnv>) {
	const requestId = c.get("requestId");
	if (error instanceof AppError) {
		return c.json(
			{
				type: "about:blank",
				title: error.message,
				status: error.status,
				code: error.code,
				...error.detail,
				requestId
			},
			error.status,
			{ "content-type": "application/problem+json" }
		);
	}
	(c.get("log") ?? console).error("unhandled error", { error });
	return c.json(
		{
			type: "about:blank",
			title: "Something went wrong on our side.",
			status: 500,
			code: "internal",
			requestId
		},
		500,
		{ "content-type": "application/problem+json" }
	);
}
