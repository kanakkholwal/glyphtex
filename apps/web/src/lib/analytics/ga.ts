import { env } from '$env/dynamic/public';
import type { AnalyticsProvider } from './types';

// `$env/dynamic/public` resolves per request, so on Cloudflare this must come from
// wrangler `vars` — a build-time env var never reaches the worker.
export const GA_ID = env.PUBLIC_GA_ID ?? '';

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

export const gaProvider: AnalyticsProvider = {
	name: 'google-analytics',
	get enabled() {
		return Boolean(GA_ID);
	},

	load() {
		const script = document.createElement('script');
		script.async = true;
		script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
		document.head.appendChild(script);

		window.dataLayer = window.dataLayer ?? [];
		window.gtag = function gtag(...args: unknown[]) {
			window.dataLayer?.push(args);
		};
		window.gtag('js', new Date());
		// Page views are sent by us on navigation, so gtag must not also send its own.
		window.gtag('config', GA_ID, { send_page_view: false });
	},

	pageview(path, title) {
		window.gtag?.('event', 'page_view', {
			page_path: path,
			page_location: window.location.href,
			page_title: title ?? document.title
		});
	},

	event(name, params) {
		window.gtag?.('event', name, params);
	},

	// gtag.js reads this flag on every call, so it also silences anything the
	// already-loaded script would have sent on its own.
	setEnabled(enabled) {
		(window as unknown as Record<string, boolean>)[`ga-disable-${GA_ID}`] = !enabled;
	}
};
