import { redirect } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";

// The sign-in page used to live here; old links and emails keep working.
export const load: PageServerLoad = ({ url }) => redirect(308, `/workspace/sign-in${url.search}`);
