import type { Config } from "../config.ts";
import type { GitProviderName } from "../db/schema.ts";
import { bitbucketProvider } from "./bitbucket.ts";
import { githubProvider } from "./github.ts";
import { gitlabProvider } from "./gitlab.ts";
import type { Fetcher, GitProvider } from "./provider.ts";

/** Hosts this deployment can connect: the ones with an OAuth app configured in Better Auth. */
export function gitProviders(
	config: Config,
	fetcher: Fetcher = fetch
): Partial<Record<GitProviderName, GitProvider>> {
	const { github, gitlab, gitlabIssuer, bitbucket } = config.oauth;
	return {
		...(github && { github: githubProvider(fetcher) }),
		...(gitlab && {
			gitlab: gitlabProvider((gitlabIssuer ?? "https://gitlab.com").replace(/\/$/, ""), fetcher)
		}),
		...(bitbucket && { bitbucket: bitbucketProvider(fetcher) })
	};
}
