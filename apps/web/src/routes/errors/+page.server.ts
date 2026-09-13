import { listGuides } from "$lib/server/guides";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => ({ guides: listGuides() });
