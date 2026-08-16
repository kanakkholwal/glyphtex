import { browser } from '$app/environment';

// A newer build is deployed when the service worker finds a changed
// service-worker.js and installs it. With skipWaiting removed (see
// service-worker.ts) that worker parks in "waiting" instead of taking over, so
// the running page keeps its current code until the user asks to update.

let reloading = false;

function messageWaiting(reg: ServiceWorkerRegistration): boolean {
	const worker = reg.waiting;
	if (!worker) return false;
	worker.postMessage('SKIP_WAITING');
	return true;
}

/**
 * Watch for a newer deployed build. `onAvailable` fires once a new worker has
 * installed and is waiting behind the one controlling this page. Returns a
 * cleanup that stops the checks. No-op off the browser or without SW support.
 *
 * Checks run on an interval, on tab focus and on regaining connectivity, so a
 * long-lived editor tab notices a deploy without a manual reload.
 */
export function watchForUpdate(onAvailable: () => void): () => void {
	if (!browser || !('serviceWorker' in navigator)) return () => {};

	let registration: ServiceWorkerRegistration | undefined;
	let interval: ReturnType<typeof setInterval> | undefined;

	const announce = () => {
		// A worker installed with no controller is the first install, not an
		// update: there is no running build to replace, so stay silent.
		if (registration?.waiting && navigator.serviceWorker.controller) onAvailable();
	};

	const check = () => registration?.update().catch(() => {});

	const onVisible = () => {
		if (document.visibilityState === 'visible') void check();
	};
	const onOnline = () => void check();

	navigator.serviceWorker.ready
		.then((reg) => {
			registration = reg;
			announce();
			reg.addEventListener('updatefound', () => {
				const installing = reg.installing;
				installing?.addEventListener('statechange', () => {
					if (installing.state === 'installed') announce();
				});
			});
			// Six deploys a day would still only be a handful of HEAD-ish requests;
			// the interval is the backstop, focus and online are the fast paths.
			interval = setInterval(check, 30 * 60 * 1000);
		})
		.catch(() => {});

	document.addEventListener('visibilitychange', onVisible);
	window.addEventListener('online', onOnline);

	return () => {
		if (interval) clearInterval(interval);
		document.removeEventListener('visibilitychange', onVisible);
		window.removeEventListener('online', onOnline);
	};
}

/** Long enough for a worker handover, short enough that a handover which never
 *  arrives does not leave the button looking dead. */
const HANDOVER_TIMEOUT_MS = 4000;

/**
 * Activate the waiting build and reload onto it. Reloads only after the new
 * worker takes control, so the page never reloads onto the old code, and only
 * once even though controllerchange can fire more than that.
 */
export async function applyUpdate(): Promise<void> {
	const reload = () => {
		if (reloading) return;
		reloading = true;
		location.reload();
	};

	if (!browser || !('serviceWorker' in navigator)) return reload();

	navigator.serviceWorker.addEventListener('controllerchange', reload);
	// Another tab on the old build can keep the new worker waiting indefinitely.
	// Reload anyway: the network still serves the newest assets.
	setTimeout(reload, HANDOVER_TIMEOUT_MS);

	const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
	if (!reg || !messageWaiting(reg)) reload();
}
