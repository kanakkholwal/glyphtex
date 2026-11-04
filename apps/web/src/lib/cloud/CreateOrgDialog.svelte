<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import { Input } from "@glyphtex/ui/input";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconLoader2 } from "@tabler/icons-svelte";

	import { cloudSession, type OrgSummary } from "./session.svelte";

	interface Props {
		open: boolean;
		oncreated?: (org: OrgSummary) => void;
	}

	let { open = $bindable(), oncreated }: Props = $props();

	let name = $state("");
	let busy = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;
		busy = true;
		try {
			const org = await cloudSession.createOrg(trimmed);
			toast.success(`${org.name} is ready. Invite people from Settings, Members.`);
			name = "";
			open = false;
			oncreated?.(org);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Could not create the organization.");
		} finally {
			busy = false;
		}
	}
</script>

<Dialog bind:open>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>Create an organization</DialogTitle>
			<DialogDescription>
				A shared space for a lab, department or team. You become its owner; projects created in it
				belong to the organization.
			</DialogDescription>
		</DialogHeader>
		<form id="create-org" class="flex flex-col gap-1.5" onsubmit={submit}>
			<label for="org-name" class="text-xs font-medium">Name</label>
			<Input id="org-name" required maxlength={80} bind:value={name} placeholder="Physics Lab" />
		</form>
		<DialogFooter>
			<Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
			<Button type="submit" form="create-org" variant="dark" disabled={busy || !name.trim()}>
				{#if busy}<IconLoader2 class="animate-spin" />{/if}
				Create
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
