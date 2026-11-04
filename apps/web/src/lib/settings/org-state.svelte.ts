import { cloud, type OrgView } from "$lib/cloud/api";
import { cloudSession } from "$lib/cloud/session.svelte";

/** The active org's view (role, capabilities, policy), loaded once per org and shared by the tabs. */
class ActiveOrg {
	view = $state<OrgView | null>(null);
	error = $state<string | null>(null);
	#loadedFor: string | null = null;

	can(permission: string) {
		return this.view?.capabilities.includes(permission as never) ?? false;
	}

	async load(force = false) {
		const orgId = cloudSession.activeOrgId;
		if (!orgId) {
			this.view = null;
			this.#loadedFor = null;
			return;
		}
		if (!force && this.#loadedFor === orgId && this.view) return;
		this.#loadedFor = orgId;
		try {
			this.view = await cloud.orgs.view(orgId);
			this.error = null;
		} catch (e) {
			this.error = e instanceof Error ? e.message : "Could not load the organization.";
		}
	}
}

export const activeOrg = new ActiveOrg();
