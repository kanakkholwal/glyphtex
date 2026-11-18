import type { GitHost } from "./api";
import { appUrl, authClient, unwrap } from "./auth";

/** Scopes asked at link time only: sign-in keeps its narrow scopes, repository access is opt-in. */
const SCOPES: Partial<Record<GitHost, string[]>> = { github: ["repo"], gitlab: ["api"] };

const HOSTS: readonly string[] = ["github", "gitlab", "bitbucket"];

/** Git hosts the signed-in user has linked, read from Better Auth's accounts. */
export async function linkedHosts(): Promise<GitHost[]> {
	const accounts = await unwrap(authClient.listAccounts());
	return accounts.map((a) => a.providerId).filter((id): id is GitHost => HOSTS.includes(id));
}

/** Starts the host's OAuth screen; the browser comes back to Settings with the outcome in the URL. */
export async function linkHost(host: GitHost): Promise<void> {
	const callbackURL = appUrl(`/workspace/settings?tab=account&git=${host}&status=connected`);
	const errorCallbackURL = appUrl(`/workspace/settings?tab=account&git=${host}&status=failed`);
	if (host === "bitbucket") {
		// Generic OAuth has no typed client in this Better Auth version; its link endpoint is plain HTTP.
		const { url } = await unwrap(
			authClient.$fetch<{ url: string }>("/oauth2/link", {
				method: "POST",
				body: { providerId: "bitbucket", callbackURL, errorCallbackURL }
			})
		);
		window.location.assign(url);
	} else {
		await unwrap(
			authClient.linkSocial({ provider: host, scopes: SCOPES[host], callbackURL, errorCallbackURL })
		);
	}
}

/** Removes the link. Better Auth asks for a recent sign-in first, and its message says so. */
export async function unlinkHost(host: GitHost): Promise<void> {
	const accounts = await unwrap(authClient.listAccounts());
	const account = accounts.find((a) => a.providerId === host);
	if (account) await unwrap(authClient.unlinkAccount({ accountId: account.id }));
}
