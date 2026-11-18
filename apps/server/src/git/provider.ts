import type { GitProviderName } from "../db/schema.ts";
import { AppError } from "../lib/errors.ts";

export interface RepoRef {
	fullName: string;
	defaultBranch: string;
	private: boolean;
}

export interface RemoteFile {
	path: string;
	size?: number;
}

export interface RemoteTree {
	/** The commit the listing was read at; pass it back to read files so a push can't race a read. */
	commit: string;
	files: RemoteFile[];
}

/** `content: null` deletes the file. */
export interface Change {
	path: string;
	content: string | null;
}

export interface CommitInput {
	branch: string;
	/** The commit the changes were computed against. */
	parent: string;
	message: string;
	changes: Change[];
	/** Create `branch` from `parent` instead of updating it. */
	newBranch?: boolean;
	/** Paths that already exist at `parent`, for hosts that distinguish create from update. */
	existing: ReadonlySet<string>;
}

/**
 * Repository operations every Git host must offer. Sign-in, token storage and refresh belong to
 * Better Auth; adapters receive a ready access token and differ only in URLs and payloads.
 */
export interface GitProvider {
	readonly name: GitProviderName;
	repos(token: string, query?: string): Promise<RepoRef[]>;
	branches(token: string, repo: string): Promise<string[]>;
	tree(token: string, repo: string, branch: string): Promise<RemoteTree>;
	readFile(token: string, repo: string, path: string, commit: string): Promise<string>;
	commit(token: string, repo: string, input: CommitInput): Promise<{ commit: string }>;
	pullRequest(
		token: string,
		repo: string,
		input: { head: string; base: string; title: string; body: string }
	): Promise<{ url: string }>;
}

export type Fetcher = typeof fetch;

const HOSTS: Record<GitProviderName, string> = {
	github: "GitHub",
	gitlab: "GitLab",
	bitbucket: "Bitbucket"
};
export const hostName = (name: GitProviderName) => HOSTS[name];

/** Maps a failed host response to an error the client can show; a 401 means the token is dead. */
export async function check(res: Response, host: string): Promise<Response> {
	if (res.ok) return res;
	if (res.status === 401) {
		throw new AppError(409, "git_reconnect", `Reconnect your ${host} account: its access expired.`);
	}
	if (res.status === 403 || res.status === 404) {
		throw new AppError(
			res.status,
			"git_forbidden",
			`${host} refused the request. Check the repository name and that your account can access it.`
		);
	}
	throw new AppError(502, "git_host_error", `${host} answered with an error (${res.status}).`);
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
