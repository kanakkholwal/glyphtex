import { Hono } from "hono";
import type { AppEnv } from "../context.ts";
import { currentUser } from "../middleware/index.ts";
import { archiveService } from "../services/archive.ts";

export const accountController = new Hono<AppEnv>()
	.get("/", (c) => {
		const user = currentUser(c);
		return c.json({ user, session: { expiresAt: c.var.session?.expiresAt } });
	})
	.get("/export", async (c) => {
		const user = currentUser(c);
		const date = new Date().toISOString().slice(0, 10);
		return c.body(await archiveService(c.var.deps).exportOwned(user.id), 200, {
			"content-type": "application/zip",
			"content-disposition": `attachment; filename="glyphtex-export-${date}.zip"`,
			"cache-control": "no-store"
		});
	});
