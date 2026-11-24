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
	import { Switch } from "@glyphtex/ui/switch";
	import { toast } from "@glyphtex/ui/sonner";
	import { IconUserPlus } from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import UserActions from "$lib/admin/UserActions.svelte";
	import UserStatus from "$lib/admin/UserStatus.svelte";
	import type { AdminUser, UserAction } from "$lib/admin/users";
	import { formatDate } from "$lib/admin/format";
	import { authClient, unwrap } from "$lib/cloud/auth";

	let users = $state<AdminUser[]>([]);
	let loading = $state(true);
	let error = $state<unknown>(null);

	async function load() {
		loading = true;
		error = null;
		try {
			const result = await unwrap(
				authClient.admin.listUsers({
					query: { limit: 200, sortBy: "createdAt", sortDirection: "desc" }
				})
			);
			users = result.users as unknown as AdminUser[];
		} catch (e) {
			error = e;
		} finally {
			loading = false;
		}
	}
	onMount(load);

	const h = dataTableColumns<AdminUser>();
	const columns = h.columns([
		h.accessor("name", {
			meta: { label: "Name" },
			header: ({ column }) => renderComponent(DataTableColumnHeader<AdminUser, string>, { column })
		}),
		h.accessor("email", {
			meta: { label: "Email" },
			header: ({ column }) => renderComponent(DataTableColumnHeader<AdminUser, string>, { column })
		}),
		h.display({
			id: "status",
			meta: { label: "Status" },
			header: "Status",
			cell: ({ row }) => renderComponent(UserStatus, { user: row.original })
		}),
		h.accessor((u) => formatDate(u.createdAt), {
			id: "created",
			meta: { label: "Joined" },
			header: ({ column }) => renderComponent(DataTableColumnHeader<AdminUser, string>, { column })
		}),
		h.display({
			id: "actions",
			enableHiding: false,
			meta: { label: "Actions", align: "end" },
			header: "",
			cell: ({ row }) => renderComponent(UserActions, { user: row.original, onaction: ask })
		})
	]);

	const table = createDataTable(() => ({ data: users, columns, getRowId: (u: AdminUser) => u.id }));

	// --- Actions -----------------------------------------------------------------
	let pending = $state<{ action: UserAction; user: AdminUser } | null>(null);
	let reason = $state("");
	let busy = $state(false);

	const COPY: Record<UserAction, { title: string; body: (u: AdminUser) => string; cta: string }> = {
		"make-admin": {
			title: "Make instance admin",
			body: (u) => `${u.email} will be able to see every account and organization on this server.`,
			cta: "Make admin"
		},
		"remove-admin": {
			title: "Remove admin access",
			body: (u) => `${u.email} will go back to a normal account.`,
			cta: "Remove admin"
		},
		ban: {
			title: "Ban account",
			body: (u) => `${u.email} is signed out and cannot sign in until you unban them.`,
			cta: "Ban"
		},
		unban: { title: "Unban account", body: (u) => `${u.email} can sign in again.`, cta: "Unban" },
		impersonate: {
			title: "View as this user",
			body: (u) =>
				`You will see GlyphTeX as ${u.email} does, until you stop. The session is recorded and expires after an hour.`,
			cta: "Start viewing"
		},
		"sign-out": {
			title: "Sign out everywhere",
			body: (u) => `Every session of ${u.email} ends. They can sign in again.`,
			cta: "Sign out"
		},
		delete: {
			title: "Delete account",
			body: (u) =>
				`${u.email} and everything only they own is deleted for good. Organizations others use are kept.`,
			cta: "Delete"
		}
	};

	function ask(action: UserAction, user: AdminUser) {
		reason = "";
		pending = { action, user };
	}

	async function confirm() {
		if (!pending) return;
		const { action, user } = pending;
		busy = true;
		try {
			const id = user.id;
			if (action === "make-admin")
				await unwrap(authClient.admin.setRole({ userId: id, role: "admin" }));
			else if (action === "remove-admin")
				await unwrap(authClient.admin.setRole({ userId: id, role: "user" }));
			else if (action === "ban")
				await unwrap(
					authClient.admin.banUser({ userId: id, banReason: reason.trim() || undefined })
				);
			else if (action === "unban") await unwrap(authClient.admin.unbanUser({ userId: id }));
			else if (action === "sign-out")
				await unwrap(authClient.admin.revokeUserSessions({ userId: id }));
			else if (action === "delete") await unwrap(authClient.admin.removeUser({ userId: id }));
			else if (action === "impersonate") {
				await unwrap(authClient.admin.impersonateUser({ userId: id }));
				location.assign("/workspace");
				return;
			}
			toast.success(`${COPY[action].title}: done.`);
			pending = null;
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "That did not work.");
		} finally {
			busy = false;
		}
	}

	// --- New account -------------------------------------------------------------
	let adding = $state(false);
	let draft = $state({ name: "", email: "", password: "", admin: false });

	async function create() {
		busy = true;
		try {
			await unwrap(
				authClient.admin.createUser({
					name: draft.name.trim(),
					email: draft.email.trim(),
					password: draft.password,
					role: draft.admin ? "admin" : "user"
				})
			);
			toast.success(`Account created for ${draft.email.trim()}.`);
			adding = false;
			draft = { name: "", email: "", password: "", admin: false };
			await load();
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Could not create the account.");
		} finally {
			busy = false;
		}
	}
	const canCreate = $derived(
		draft.name.trim() !== "" && draft.email.includes("@") && draft.password.length >= 10
	);
</script>

<div class="mb-4 flex items-center gap-3">
	<p class="text-muted-foreground text-sm">{users.length} accounts</p>
	<Button class="ml-auto" size="sm" variant="dark" onclick={() => (adding = true)}>
		<IconUserPlus /> New account
	</Button>
</div>

<DataTable {loading} {error} onretry={load}>
	<DataTableToolbar>
		<DataTableSearch {table} placeholder="Search accounts" />
	</DataTableToolbar>
	<DataTableContent {table} />
	<DataTablePagination {table} />
</DataTable>

<Dialog bind:open={() => pending !== null, (open) => !open && (pending = null)}>
	<DialogContent>
		{#if pending}
			<DialogHeader>
				<DialogTitle>{COPY[pending.action].title}</DialogTitle>
				<DialogDescription>{COPY[pending.action].body(pending.user)}</DialogDescription>
			</DialogHeader>
			{#if pending.action === "ban"}
				<div class="grid gap-2">
					<Label for="ban-reason">Reason (optional, shown to you only)</Label>
					<Input id="ban-reason" bind:value={reason} />
				</div>
			{/if}
			<DialogFooter>
				<Button variant="ghost" onclick={() => (pending = null)}>Cancel</Button>
				<Button
					variant={pending.action === "delete" || pending.action === "ban" ? "destructive" : "dark"}
					disabled={busy}
					onclick={confirm}
				>
					{COPY[pending.action].cta}
				</Button>
			</DialogFooter>
		{/if}
	</DialogContent>
</Dialog>

<Dialog bind:open={adding}>
	<DialogContent>
		<DialogHeader>
			<DialogTitle>New account</DialogTitle>
			<DialogDescription>
				Creates a verified account. Share the password through a safe channel; they can change it
				after signing in.
			</DialogDescription>
		</DialogHeader>
		<div class="grid gap-4">
			<div class="grid gap-2">
				<Label for="new-name">Name</Label>
				<Input id="new-name" bind:value={draft.name} autocomplete="off" />
			</div>
			<div class="grid gap-2">
				<Label for="new-email">Email</Label>
				<Input id="new-email" type="email" bind:value={draft.email} autocomplete="off" />
			</div>
			<div class="grid gap-2">
				<Label for="new-password">Password (10 or more characters)</Label>
				<Input id="new-password" type="password" bind:value={draft.password} autocomplete="new-password" />
			</div>
			<div class="flex items-center justify-between gap-3">
				<Label for="new-admin">Instance admin</Label>
				<Switch id="new-admin" bind:checked={draft.admin} />
			</div>
		</div>
		<DialogFooter>
			<Button variant="ghost" onclick={() => (adding = false)}>Cancel</Button>
			<Button variant="dark" disabled={!canCreate || busy} onclick={create}>Create account</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
