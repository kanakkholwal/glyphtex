import { browser } from "$app/environment";
import { invalidateAll } from "$app/navigation";
import { page } from "$app/state";
import { authClient, unwrap } from "./auth";
import { cloudEnabled } from "./config";
import { type SessionOrg, type SessionUser, toSessionUser } from "./session-user";

const ENSURE_TIMEOUT_MS = 2500;
const RETRY_AFTER_MS = 15_000;

type Status = "idle" | "loading" | "ready" | "error";
export type OrgSummary = SessionOrg;

/**
 * The signed-in user and their active org. The server render is the owner when it could check
 * (`page.data.auth`, per request, so SSR and hydration agree); the browser fetch only fills in
 * when it couldn't. Mutations end in `invalidateAll()` so the owner refreshes.
 */
class CloudSession {
	#clientStatus = $state<Status>("idle");
	#user = $state<SessionUser | null>(null);
	#activeOrgId = $state<string | null>(null);
	#orgs = $state<OrgSummary[]>([]);
	#pending: Promise<void> | null = null;
	#failedAt = 0;

	get #server() {
		const auth = page.data.auth;
		return auth?.checked ? auth : null;
	}

	get user(): SessionUser | null {
		return this.#server ? this.#server.user : this.#user;
	}

	get activeOrgId(): string | null {
		return this.#server ? this.#server.activeOrgId : this.#activeOrgId;
	}

	get orgs(): OrgSummary[] {
		return this.#server ? this.#server.orgs : this.#orgs;
	}

	get status(): Status {
		return this.#server ? "ready" : this.#clientStatus;
	}

	get signedIn() {
		return this.user !== null;
	}

	get activeOrg() {
		return this.orgs.find((o) => o.id === this.activeOrgId) ?? null;
	}

	/** First read is shared, so every component mounting at once makes one request. */
	ensure(): Promise<void> {
		if (!browser || !cloudEnabled) return Promise.resolve();
		if (this.status === "ready") return Promise.resolve();
		// After a failed read, wait before asking again: callers that re-run on this status would loop
		// forever against an unreachable server.
		if (this.status === "error" && Date.now() - this.#failedAt < RETRY_AFTER_MS)
			return Promise.resolve();
		this.#pending ??= this.refresh().finally(() => (this.#pending = null));
		// An unreachable server must not hold up local documents: stop waiting after a moment and
		// treat the visitor as signed out until the request settles.
		return Promise.race([
			this.#pending,
			new Promise<void>((done) => setTimeout(done, ENSURE_TIMEOUT_MS))
		]);
	}

	async refresh(): Promise<void> {
		if (!browser || !cloudEnabled) return;
		this.#clientStatus = "loading";
		try {
			const { data } = await authClient.getSession();
			this.#user = data?.user ? toSessionUser(data.user) : null;
			const active = (data?.session as { activeOrganizationId?: string | null } | undefined)
				?.activeOrganizationId;
			this.#activeOrgId = active ?? null;
			this.#orgs = this.#user ? ((await authClient.organization.list()).data ?? []) : [];
			this.#clientStatus = "ready";
		} catch {
			// The server being down must not block local documents; treat as signed out.
			this.#user = null;
			this.#orgs = [];
			this.#activeOrgId = null;
			this.#clientStatus = "error";
			this.#failedAt = Date.now();
		}
	}

	async switchTo(orgId: string | null): Promise<void> {
		await unwrap(authClient.organization.setActive({ organizationId: orgId }));
		this.#activeOrgId = orgId;
		await invalidateAll();
	}

	async createOrg(name: string): Promise<OrgSummary> {
		const base = name
			.toLowerCase()
			.normalize("NFKD")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-|-$/g, "")
			.slice(0, 40);
		// A short suffix keeps slugs unique without asking people to invent one.
		const slug = `${base || "org"}-${crypto.randomUUID().slice(0, 6)}`;
		const org = await unwrap(authClient.organization.create({ name, slug }));
		await this.refresh();
		await this.switchTo(org.id);
		return org;
	}

	async signOut(): Promise<void> {
		await authClient.signOut();
		this.#user = null;
		this.#orgs = [];
		this.#activeOrgId = null;
		// Re-run server loads so the layout's auth snapshot no longer says signed in.
		await invalidateAll();
	}
}

export const cloudSession = new CloudSession();
