import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.auth.checked && !locals.auth.user) {
		redirect(303, `/workspace/account?next=${encodeURIComponent(url.pathname + url.search)}`);
	}
};
