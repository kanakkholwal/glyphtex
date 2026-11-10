import { redirect } from "@sveltejs/kit";
import { safeNext } from "$lib/cloud/next";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
	// Signed-in visitors never see the form: they sign out first. `?deleted=1` is the post-deletion notice.
	if (locals.auth.user && url.searchParams.get("deleted") !== "1") {
		redirect(303, safeNext(url.searchParams.get("next"), "/workspace/settings?tab=account"));
	}
};
