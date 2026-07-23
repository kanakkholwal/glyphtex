import { browser } from '$app/environment';
import { gaProvider } from './ga';
import type { AnalyticsEvent, AnalyticsProvider, EventParams } from './types';

export type { AnalyticsEvent, AnalyticsProvider, DocumentSource, EventParams } from './types';

/** Registry. Add a backend here and the rest of the app needs no changes. */
const providers: AnalyticsProvider[] = [gaProvider];

const OPT_OUT_KEY = 'glyphtex.analytics.optOut';

const active = () => providers.filter((p) => p.enabled);

/** True when any backend is configured, regardless of the visitor's choice. */
export const analyticsConfigured = (): boolean => active().length > 0;

export function hasOptedOut(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem(OPT_OUT_KEY) === '1';
	} catch {
		// Blocked site storage means we can't record a choice, so assume the
		// stricter one rather than tracking someone who may have opted out before.
		return true;
	}
}

export function setOptedOut(value: boolean): void {
	try {
		if (value) localStorage.setItem(OPT_OUT_KEY, '1');
		else localStorage.removeItem(OPT_OUT_KEY);
	} catch {
		/* nothing to persist to; `hasOptedOut` already fails closed */
	}
	// A backend loaded earlier in this page keeps its own state, so tell it too.
	for (const p of active()) p.setEnabled?.(!value);
	if (!value) initAnalytics();
}

const live = () => (browser && !hasOptedOut() ? active() : []);

let loaded = false;

/** Load every configured backend. Safe to call more than once. */
export function initAnalytics(): void {
	if (loaded) return;
	const ready = live();
	if (ready.length === 0) return;
	loaded = true;
	for (const p of ready) {
		try {
			void p.load();
		} catch {
			/* a dead analytics backend must never take the page down */
		}
	}
}

export function trackPageview(path: string, title?: string): void {
	for (const p of live()) {
		try {
			p.pageview(path, title);
		} catch {
			/* ignore */
		}
	}
}

/** Record a product event. Params must stay counts, durations, and fixed enums. */
export function track(name: AnalyticsEvent, params: EventParams = {}): void {
	for (const p of live()) {
		try {
			p.event(name, params);
		} catch {
			/* ignore */
		}
	}
}

/** Coarse buckets, so a document's size can be reported without its contents. */
export function bucket(n: number): string {
	if (n <= 1) return '1';
	if (n <= 5) return '2-5';
	if (n <= 20) return '6-20';
	if (n <= 100) return '21-100';
	return '100+';
}
