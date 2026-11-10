import { fail } from "@sveltejs/kit";
import { OPEN_LIMITS, parseOpenParams } from "$lib/open/request";
import type { Actions, PageServerLoad } from "./$types";

// The confirmation button must not be clickable inside another site's frame.
const GUARD_HEADERS = {
	"x-frame-options": "DENY",
	"content-security-policy": "frame-ancestors 'none'",
	"referrer-policy": "no-referrer",
	"cache-control": "no-store",
	"x-robots-tag": "noindex"
};

// Body ceiling with headroom for form encoding of a full-size snippet.
const MAX_BODY = OPEN_LIMITS.snippetChars * 3 + 4096;

export const load: PageServerLoad = ({ url, setHeaders }) => {
	setHeaders(GUARD_HEADERS);
	if (![...url.searchParams.keys()].length) return { parsed: null };
	return { parsed: parseOpenParams((k) => url.searchParams.get(k)) };
};

export const actions: Actions = {
	default: async ({ request, setHeaders }) => {
		setHeaders(GUARD_HEADERS);
		const length = Number(request.headers.get("content-length") ?? "0");
		if (length > MAX_BODY) return fail(413, { error: "That request is too large." });
		let data: FormData;
		try {
			data = await request.formData();
		} catch {
			return fail(400, { error: "Send the fields as a form (urlencoded or multipart)." });
		}
		const text = (k: string) => {
			const v = data.get(k);
			return typeof v === "string" ? v : null;
		};
		const parsed = parseOpenParams(text);
		return parsed.ok ? { parsed } : fail(400, { error: parsed.error });
	}
};
