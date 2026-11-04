import { createAuthClient } from "better-auth/client";
import { magicLinkClient } from "better-auth/client/plugins";
import { SERVER_URL } from "./config";

/** Better Auth's own client: sign-in, sign-up, OAuth, magic link, verification, deletion. */
export const authClient = createAuthClient({
	baseURL: `${SERVER_URL || "http://localhost"}/api/auth`,
	fetchOptions: { credentials: "include" },
	plugins: [magicLinkClient()]
});

export type CloudUser = NonNullable<
	Awaited<ReturnType<typeof authClient.getSession>>["data"]
>["user"];

/** Better Auth returns `{ error }` instead of throwing; this turns it into one message. */
export async function unwrap<T>(
	call: Promise<{ data: T | null; error: { message?: string; status?: number } | null }>
): Promise<T> {
	let result: Awaited<typeof call>;
	try {
		result = await call;
	} catch {
		throw new Error("Can't reach the GlyphTeX server. Check your connection and try again.");
	}
	if (result.error) {
		throw new Error(result.error.message || `Request failed (${result.error.status ?? "?"}).`);
	}
	return result.data as T;
}

/** Absolute URL back into this app, for links the server emails or redirects to. */
export const appUrl = (path: string) =>
	typeof location === "undefined" ? path : new URL(path, location.origin).toString();
