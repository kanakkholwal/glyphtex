import { requireSignedIn } from "$lib/server/guard";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ locals, url }) => {
	requireSignedIn(locals.auth, url);
	return { auth: locals.auth };
};
