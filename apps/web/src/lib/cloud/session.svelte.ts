import { browser } from "$app/environment";
import { authClient, type CloudUser, unwrap } from "./auth";
import { cloudEnabled } from "./config";

type Status = "idle" | "loading" | "ready" | "error";
export type OrgSummary = { id: string; name: string; slug: string; logo?: string | null };

/** The signed-in user and their active org, owned here; components read it and call `refresh`. */
class CloudSession {
	user = $state<CloudUser | null>(null);
	status = $state<Status>("idle");
	/** Better Auth keeps the active org on the session; null is the personal space. */
	activeOrgId = $state<string | null>(null);
	orgs = $state<OrgSummary[]>([]);
	#pending: Promise<void> | null = null;

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
		this.#pending ??= this.refresh().finally(() => (this.#pending = null));
		return this.#pending;
	}

	async refresh(): Promise<void> {
		if (!browser || !cloudEnabled) return;
		this.status = "loading";
		try {
			const { data } = await authClient.getSession();
			this.user = data?.user ?? null;
			const active = (data?.session as { activeOrganizationId?: string | null } | undefined)
				?.activeOrganizationId;
			this.activeOrgId = active ?? null;
			this.orgs = this.user ? ((await authClient.organization.list()).data ?? []) : [];
			this.status = "ready";
		} catch {
			// The server being down must not block local documents; treat as signed out.
			this.user = null;
			this.orgs = [];
			this.activeOrgId = null;
			this.status = "error";
		}
	}

	async switchTo(orgId: string | null): Promise<void> {
		await unwrap(authClient.organization.setActive({ organizationId: orgId }));
		this.activeOrgId = orgId;
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
		this.user = null;
		this.orgs = [];
		this.activeOrgId = null;
	}
}

export const cloudSession = new CloudSession();
