import { packageDetail, packagePageNames } from "$lib/server/packages";
import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = async () =>
	[...(await packagePageNames())].map((name) => ({ name }));

export const load: PageServerLoad = async ({ params }) => {
	const detail = await packageDetail(params.name);
	if (!detail) throw error(404, "Package not found");
	return detail;
};
