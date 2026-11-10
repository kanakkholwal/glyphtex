import { redirect } from "@sveltejs/kit";
import type { SsrAuth } from "./session";

/** Sends signed-out visitors to sign-in before any page renders. Unchecked (no cloud) passes through. */
export function requireSignedIn(auth: SsrAuth, url: URL): void {
	if (auth.checked && !auth.user) {
		redirect(303, `/workspace/sign-in?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
}
