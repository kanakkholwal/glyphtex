// Desktop runs as a pure client-side SPA inside the Tauri WebView.
// No SSR, no prerender: adapter-static emits a single index.html fallback
// and the client handles all routing in-process.
export const ssr = false;
export const prerender = false;
