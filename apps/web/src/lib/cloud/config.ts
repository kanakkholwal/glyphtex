import { env } from "$env/dynamic/public";

// Read per request on Cloudflare (wrangler `vars`), like PUBLIC_GA_ID. Unset hides every
// account and cloud feature, so the public site stays account-free by default.
export const SERVER_URL = (env.PUBLIC_GLYPHTEX_SERVER_URL ?? "").replace(/\/$/, "");

export const cloudEnabled = SERVER_URL !== "";

/** Route ids for cloud documents carry this prefix so they never collide with local ids. */
export const cloudHref = (id: string) => `/workspace/cloud/${encodeURIComponent(id)}`;
