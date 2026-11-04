import { Hono } from "hono";
import type { AppEnv } from "../context.ts";
import type { PublicConfig } from "../contract.ts";

/** What the sign-in screen may offer. No session needed; nothing secret in it. */
export const publicController = new Hono<AppEnv>().get("/config", (c) => {
	const { oauth, limits } = c.var.deps.config;
	const providers = (["google", "github", "gitlab"] as const).filter((p) => oauth[p]);
	return c.json({
		providers,
		magicLink: true,
		limits: {
			textFileBytes: limits.textFileBytes,
			binaryFileBytes: limits.binaryFileBytes,
			filesPerProject: limits.filesPerProject
		}
	} satisfies PublicConfig);
});
