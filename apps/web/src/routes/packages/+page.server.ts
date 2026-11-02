import { listPackages } from "$lib/server/packages";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = async () => ({ packages: await listPackages() });
