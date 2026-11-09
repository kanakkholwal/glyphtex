import { cloud, type PublicConfig } from "./api";

let pending: Promise<PublicConfig> | undefined;

/** One shared request, so a page can start it early and the sign-in panel finds it already done. */
export function publicConfig(): Promise<PublicConfig> {
	pending ??= cloud.config().catch((error: unknown) => {
		pending = undefined;
		throw error;
	});
	return pending;
}
