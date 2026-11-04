import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { AppEnv } from "../context.ts";
import { errors } from "../lib/errors.ts";
import { currentUser, requireProject } from "../middleware/index.ts";
import { fileService, type Precondition } from "../services/files.ts";
import { validate } from "./validation.ts";

const pathQuery = z.object({ path: z.string().min(1).max(512) });
const etag = (version: number) => `"${version}"`;

function parseVersion(header: string | undefined) {
	const match = header?.trim().match(/^(?:W\/)?"(\d+)"$/);
	return match ? Number(match[1]) : null;
}

/** Writes must state what they expect, so a stale client can never silently overwrite. */
function precondition(c: Context<AppEnv>): Precondition {
	if (c.req.header("if-none-match")?.trim() === "*") return { create: true };
	const version = parseVersion(c.req.header("if-match"));
	if (version === null) {
		throw errors.preconditionRequired(
			'Send If-Match: "<version>" to update, or If-None-Match: * to create.'
		);
	}
	return { version };
}

function requiredVersion(c: Context<AppEnv>) {
	const version = parseVersion(c.req.header("if-match"));
	if (version === null) throw errors.preconditionRequired('Send If-Match: "<version>".');
	return version;
}

export const filesController = new Hono<AppEnv>()
	.get("/:projectId/files", requireProject("project:read"), async (c) =>
		c.json({ files: await fileService(c.var.deps).list(c.var.access) })
	)
	.get(
		"/:projectId/files/raw",
		requireProject("project:read"),
		validate("query", pathQuery),
		async (c) => {
			const { file, text, blob } = await fileService(c.var.deps).read(
				c.var.access,
				c.req.valid("query").path
			);
			c.header("etag", etag(file.version));
			c.header("cache-control", "private, no-cache");
			if (parseVersion(c.req.header("if-none-match")) === file.version) return c.body(null, 304);
			if (text !== null) return c.text(text, 200, { "content-type": "text/plain; charset=utf-8" });
			return c.body(blob.body, 200, {
				"content-type": blob.contentType ?? "application/octet-stream",
				"content-length": String(blob.size)
			});
		}
	)
	.put(
		"/:projectId/files/raw",
		requireProject("project:write"),
		validate("query", pathQuery),
		(c, next) =>
			bodyLimit({
				maxSize: c.var.deps.config.limits.binaryFileBytes,
				onError: () => {
					throw errors.tooLarge("The file is larger than the upload limit.");
				}
			})(c, next),
		async (c) => {
			const meta = await fileService(c.var.deps).write(
				c.var.access,
				currentUser(c).id,
				c.req.valid("query").path,
				new Uint8Array(await c.req.arrayBuffer()),
				c.req.header("content-type")?.split(";")[0],
				precondition(c)
			);
			c.header("etag", etag(meta.version));
			return c.json({ file: meta }, meta.version === 1 ? 201 : 200);
		}
	)
	.delete(
		"/:projectId/files/raw",
		requireProject("project:write"),
		validate("query", pathQuery),
		async (c) => {
			await fileService(c.var.deps).remove(
				c.var.access,
				c.req.valid("query").path,
				requiredVersion(c)
			);
			return c.body(null, 204);
		}
	)
	.post(
		"/:projectId/files/rename",
		requireProject("project:write"),
		validate("json", z.object({ from: z.string().min(1), to: z.string().min(1) })),
		async (c) => {
			const { from, to } = c.req.valid("json");
			const meta = await fileService(c.var.deps).rename(c.var.access, from, to, requiredVersion(c));
			c.header("etag", etag(meta.version));
			return c.json({ file: meta });
		}
	);
