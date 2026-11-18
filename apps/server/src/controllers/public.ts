import { Hono } from "hono";
import type { AppEnv } from "../context.ts";
import { gitProviders } from "../git/index.ts";
import type { PublicConfig, ServerInfo } from "../contract.ts";

/** What the sign-in screen may offer. No session needed; nothing secret in it. */
export const publicController = new Hono<AppEnv>()
	.get("/config", (c) => {
		const { oauth, limits, mailEnabled, blobsEnabled } = c.var.deps.config;
		const providers = (["google", "github", "gitlab", "orcid"] as const).filter((p) => oauth[p]);
		return c.json({
			providers,
			magicLink: mailEnabled,
			features: { mail: mailEnabled, blobs: blobsEnabled, live: c.var.realtime },
			limits: {
				textFileBytes: limits.textFileBytes,
				binaryFileBytes: limits.binaryFileBytes,
				filesPerProject: limits.filesPerProject
			}
		} satisfies PublicConfig);
	})
	.get("/info", (c) => {
		const { deps, realtime } = { deps: c.var.deps, realtime: c.var.realtime };
		const { oauth, limits, mailEnabled, blobsEnabled, requireEmailVerification } = deps.config;
		const build = deps.build;
		return c.json({
			name: "glyphtex-server",
			version: build?.version ?? "unknown",
			runtime: build?.runtime ?? "node",
			commit: build?.commit ?? null,
			deployedAt: build?.deployedAt ?? null,
			startedAt: build?.startedAt ?? "",
			features: {
				mail: mailEnabled,
				blobs: blobsEnabled,
				live: realtime,
				magicLink: mailEnabled,
				emailVerification: requireEmailVerification,
				passkeys: true,
				twoFactor: true,
				sso: true,
				scim: true
			},
			gitProviders: Object.keys(gitProviders(deps.config)) as ServerInfo["gitProviders"],
			providers: (["google", "github", "gitlab", "orcid"] as const).filter((p) => oauth[p]),
			limits: {
				textFileBytes: limits.textFileBytes,
				binaryFileBytes: limits.binaryFileBytes,
				filesPerProject: limits.filesPerProject,
				live: deps.config.live
			}
		} satisfies ServerInfo);
	});
