export type GitIdentity = { name: string; email: string };

const NAME_KEY = 'glyphtex.git.name';
const EMAIL_KEY = 'glyphtex.git.email';
const PROXY_KEY = 'glyphtex.git.corsProxy';

/** GitHub and GitLab serve smart-HTTP without CORS headers, so every fetch/pull/push
 *  is relayed. This public relay sees the traffic, hence user-editable. */
export const DEFAULT_CORS_PROXY = 'https://cors.isomorphic-git.org';

const DEFAULT_IDENTITY: GitIdentity = { name: 'GlyphTeX user', email: 'user@glyphtex.local' };

const read = (key: string): string => {
	try {
		return localStorage.getItem(key)?.trim() ?? '';
	} catch {
		return '';
	}
};

const write = (key: string, value: string): void => {
	try {
		if (value) localStorage.setItem(key, value);
		else localStorage.removeItem(key);
	} catch {
		/* private mode / storage disabled — the defaults still work */
	}
};

export function getIdentity(): GitIdentity {
	return {
		name: read(NAME_KEY) || DEFAULT_IDENTITY.name,
		email: read(EMAIL_KEY) || DEFAULT_IDENTITY.email
	};
}

export function setIdentity(identity: Partial<GitIdentity>): void {
	if (identity.name !== undefined) write(NAME_KEY, identity.name.trim());
	if (identity.email !== undefined) write(EMAIL_KEY, identity.email.trim());
}

/** Whether the user has chosen an identity, as opposed to falling back to ours. */
export const hasIdentity = (): boolean => Boolean(read(NAME_KEY) && read(EMAIL_KEY));

export function getCorsProxy(): string | undefined {
	const stored = read(PROXY_KEY);
	if (stored === 'none') return undefined;
	return stored || DEFAULT_CORS_PROXY;
}

export function setCorsProxy(url: string): void {
	const clean = url.trim().replace(/\/+$/, '');
	write(PROXY_KEY, clean || '');
}
