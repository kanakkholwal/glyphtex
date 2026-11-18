import { browser } from "$app/environment";
import { setTelemetry } from "@glyphtex/ui/telemetry";
import { gaProvider } from "./ga";
import type { AnalyticsEvent, AnalyticsProvider, EventParams } from "./types";

export { viewSection } from "./section-view";
export type {
	AnalyticsEvent,
	AnalyticsProvider,
	CtaLocation,
	DocumentSource,
	EventParams,
	SiteEvent,
	WorkspaceEvent
} from "./types";

/** Registry. Add a backend here and the rest of the app needs no changes. */
const providers: AnalyticsProvider[] = [gaProvider];

const CONSENT_KEY = "glyphtex.analytics.consent";
// Before consent existed, "1" meant the visitor had switched analytics off.
const LEGACY_OPT_OUT_KEY = "glyphtex.analytics.optOut";

export type ConsentChoice = "granted" | "denied";

const active = () => providers.filter((p) => p.enabled);

/** True when any backend is configured, regardless of the visitor's choice. */
export const analyticsConfigured = (): boolean => active().length > 0;

/** Null means not asked yet. Blocked storage reads as denied: no way to remember a yes. */
export function consentChoice(): ConsentChoice | null {
	if (!browser) return null;
	try {
		if (localStorage.getItem(LEGACY_OPT_OUT_KEY) === "1") return "denied";
		const v = localStorage.getItem(CONSENT_KEY);
		return v === "granted" || v === "denied" ? v : null;
	} catch {
		return "denied";
	}
}

/** Decision (product): analytics are opt-in; nothing loads or sends until the visitor says yes. */
export function setConsent(choice: ConsentChoice): void {
	try {
		localStorage.setItem(CONSENT_KEY, choice);
		if (choice === "granted") localStorage.removeItem(LEGACY_OPT_OUT_KEY);
	} catch {
		/* nothing to persist to; consentChoice already reads as denied */
	}
	// A backend loaded earlier in this page keeps its own state, so tell it too.
	for (const p of active()) p.setEnabled?.(choice === "granted");
	if (choice === "granted") initAnalytics();
}

const live = () => (browser && consentChoice() === "granted" ? active() : []);

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

const sent = new Set<string>();

/** Record an event at most once per page load. For "did they reach this at all"
 *  signals (a section scrolled into view, the first edit in the demo). */
export function trackOnce(key: string, name: AnalyticsEvent, params: EventParams = {}): void {
	if (sent.has(key)) return;
	sent.add(key);
	track(name, params);
}

/** Point the editor's own telemetry at this registry. The desktop build never
 *  calls this, which is what keeps it analytics-free. */
export function connectWorkbench(): void {
	setTelemetry((name, params) => track(name, params));
}

/** Coarse buckets, so a document's size can be reported without its contents. */
export function bucket(n: number): string {
	if (n <= 1) return "1";
	if (n <= 5) return "2-5";
	if (n <= 20) return "6-20";
	if (n <= 100) return "21-100";
	return "100+";
}
