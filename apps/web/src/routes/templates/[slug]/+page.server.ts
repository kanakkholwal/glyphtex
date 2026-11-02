import { packagePageNames } from "$lib/server/packages";
import { templateDetail, templateSlugs } from "$lib/server/templates";
import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = async () =>
	(await templateSlugs()).map((slug) => ({ slug }));

export const load: PageServerLoad = async ({ params }) => {
	const detail = await templateDetail(params.slug);
	if (!detail) throw error(404, "Template not found");
	return { ...detail, packagePages: [...(await packagePageNames())] };
};
