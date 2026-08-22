import { listPosts, listTags } from "$lib/server/content";
import { error } from "@sveltejs/kit";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () => listTags().map(({ tag }) => ({ tag }));

export const load: PageServerLoad = ({ params }) => {
	const posts = listPosts().filter((post) => post.tags.includes(params.tag));
	if (posts.length === 0) throw error(404, "No articles for this tag");
	return { tag: params.tag, posts, tags: listTags() };
};
