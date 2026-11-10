import { redirect } from "@sveltejs/kit";
import { safeNext } from "$lib/cloud/next";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
	const deleted = url.searchParams.get("deleted") === "1";
	// Signed-in visitors never see the sign-in form, not even for one frame.
	const forgot = url.searchParams.get("mode") === "forgot";
	if (locals.auth.user && !deleted && !forgot) {
		redirect(303, safeNext(url.searchParams.get("next"), "/workspace/settings?tab=account"));
	}
};
