import { templateDetail, templateSlugs } from "$lib/server/templates";
import { error } from "@sveltejs/kit";
import type { EntryGenerator, RequestHandler } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = async () =>
	(await templateSlugs()).map((slug) => ({ slug }));

export const GET: RequestHandler = async ({ params }) => {
	const detail = await templateDetail(params.slug);
	if (!detail) throw error(404, "Template not found");
	return new Response(detail.source, {
		headers: { "content-type": "text/x-tex; charset=utf-8" }
	});
};
