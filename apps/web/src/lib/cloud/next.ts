/** Only same-app paths: `//evil.com` or `https://…` would make `?next=` an open redirect. */
export function safeNext(value: string | null | undefined, fallback = "/workspace"): string {
	if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
		return fallback;
	}
	return value;
}
