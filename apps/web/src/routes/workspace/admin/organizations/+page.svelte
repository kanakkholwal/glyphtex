<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import {
		createDataTable,
		DataTable,
		DataTableColumnHeader,
		DataTableContent,
		DataTablePagination,
		DataTableSearch,
		DataTableToolbar,
		dataTableColumns,
		renderComponent
	} from "@glyphtex/ui/data-table";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from "@glyphtex/ui/dialog";
	import { Input } from "@glyphtex/ui/input";
	import { Label } from "@glyphtex/ui/label";
	import { toast } from "@glyphtex/ui/sonner";
	import { onMount } from "svelte";

	import { formatBytes, formatDate, formatNumber } from "$lib/admin/format";
	import OrgActions from "$lib/admin/OrgActions.svelte";
	import { type AdminOrg, CloudError, cloud } from "$lib/cloud/api";

	let orgs = $state<AdminOrg[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			orgs = await cloud.admin.organizations();
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(load);

	const h = dataTableColumns<AdminOrg>();
	const columns = h.columns([
		h.accessor("name", {
			meta: { label: "Organization" },
			header: ({ column }) => renderComponent(DataTableColumnHeader<AdminOrg, string>, { column })
		}),
		h.accessor("slug", { meta: { label: "Slug" }, header: "Slug" }),
		h.accessor("members", {
			meta: { label: "Seats", align: "end" },
			header: ({ column }) => renderComponent(DataTableColumnHeader<AdminOrg, number>, { column })
		}),
		h.accessor("projects", {
			meta: { label: "Projects", align: "end" },
			header: ({ column }) => renderComponent(DataTableColumnHeader<AdminOrg, number>, { column })
		}),
		h.accessor((o) => formatBytes(o.bytes), {
			id: "storage",
			meta: { label: "Storage", align: "end" },
			header: "Storage"
		}),
		h.accessor((o) => (o.sso ? "On" : "Off"), { id: "sso", meta: { label: "SSO" }, header: "SSO" }),
		h.accessor((o) => formatDate(o.createdAt), {
			id: "created",
			meta: { label: "Created" },
			header: "Created"
		}),
		h.display({
			id: "actions",
			enableHiding: false,
			meta: { label: "Actions", align: "end" },
			header: "",
			cell: ({ row }) => renderComponent(OrgActions, { org: row.original, onedit: edit })
		})
	]);

	const table = createDataTable(() => ({ data: orgs, columns, getRowId: (o: AdminOrg) => o.id }));

	let editing = $state<AdminOrg | null>(null);
	let draft = $state({ name: "", slug: "" });
	let busy = $state(false);

	function edit(org: AdminOrg) {
		draft = { name: org.name, slug: org.slug };
		editing = org;
	}

	async function save() {
		if (!editing) return;
		busy = true;
		try {
			await cloud.admin.updateOrganization(editing.id, {
				...(draft.name.trim() !== editing.name && { name: draft.name.trim() }),
				...(draft.slug.trim() !== editing.slug && { slug: draft.slug.trim() })
			});
			toast.success("Organization updated.");
			editing = null;
			await load();
		} catch (e) {
			toast.error(e instanceof CloudError ? e.message : "Could not save.");
		} finally {
			busy = false;
		}
	}
</script>

<p class="text-muted-foreground mb-4 text-sm">{formatNumber(orgs.length)} organizations</p>

<DataTable {loading} {error} onretry={load}>
	<DataTableToolbar>
		<DataTableSearch {table} placeholder="Search organizations" />
	</DataTableToolbar>
	<DataTableContent {table} />
	<DataTablePagination {table} />
</DataTable>

<Dialog bind:open={() => editing !== null, (open) => !open && (editing = null)}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>Edit organization</DialogTitle>
			<DialogDescription>
				Name and slug only. Members, roles and policy stay with the organization's own owners. The
				change is written to the organization's audit log.
			</DialogDescription>
		</DialogHeader>
		<div class="grid gap-4">
			<div class="grid gap-2">
				<Label for="org-name">Name</Label>
				<Input id="org-name" bind:value={draft.name} />
			</div>
			<div class="grid gap-2">
				<Label for="org-slug">Slug</Label>
				<Input id="org-slug" bind:value={draft.slug} />
			</div>
		</div>
		<DialogFooter>
			<Button variant="ghost" onclick={() => (editing = null)}>Cancel</Button>
			<Button variant="dark" disabled={busy || draft.name.trim() === "" || draft.slug.trim() === ""} onclick={save}>
				Save
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
