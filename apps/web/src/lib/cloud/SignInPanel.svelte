<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Input } from "@glyphtex/ui/input";
	import { Separator } from "@glyphtex/ui/separator";
	import { Tabs, TabsContent, TabsList, TabsTrigger } from "@glyphtex/ui/tabs";
	import {
		IconBrandGithub,
		IconBrandGitlab,
		IconBrandGoogle,
		IconBuilding,
		IconLoader2,
		IconMail
	} from "@tabler/icons-svelte";
	import { onMount } from "svelte";

	import { cloud, type PublicConfig } from "./api";
	import { appUrl, authClient, unwrap } from "./auth";
	import { cloudSession } from "./session.svelte";

	interface Props {
		/** Where to land after signing in (already validated by the caller). */
		next: string;
		onsignedin: () => void;
	}

	let { next, onsignedin }: Props = $props();

	let config = $state<PublicConfig | undefined>(undefined);
	let mode = $state<"signin" | "signup" | "sso">("signin");
	/** Set once the password was right but the account has an authenticator to confirm. */
	let challenge = $state(false);
	let code = $state("");
	let backup = $state(false);
	let name = $state("");
	let email = $state("");
	let password = $state("");
	let busy = $state(false);
	let error = $state<string | undefined>(undefined);
	/** Set once a mail went out, so the form gives way to "check your inbox". */
	let sent = $state<string | undefined>(undefined);

	onMount(async () => {
		try {
			config = await cloud.config();
		} catch {
			// Without config we still offer email sign-in, which every server supports.
		}
	});

	async function run(task: () => Promise<void>) {
		busy = true;
		error = undefined;
		try {
			await task();
		} catch (e) {
			error = e instanceof Error ? e.message : "Something went wrong.";
		} finally {
			busy = false;
		}
	}

	const callbackURL = () => appUrl(next);

	function submit(event: SubmitEvent) {
		event.preventDefault();
		void run(async () => {
			if (mode === "signup") {
				const created = await unwrap(
					authClient.signUp.email({
						name: name.trim() || email,
						email,
						password,
						callbackURL: callbackURL()
					})
				);
				// No token means the server wants the address verified before the first sign-in.
				if (!created.token) {
					sent = `We sent a verification link to ${email}. Open it to finish signing up.`;
					return;
				}
			} else {
				const result = await unwrap(
					authClient.signIn.email({ email, password, callbackURL: callbackURL() })
				);
				if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
					challenge = true;
					return;
				}
			}
			await cloudSession.refresh();
			onsignedin();
		});
	}

	function confirmCode(event: SubmitEvent) {
		event.preventDefault();
		void run(async () => {
			const value = code.trim();
			await unwrap(
				backup
					? authClient.twoFactor.verifyBackupCode({ code: value })
					: authClient.twoFactor.verifyTotp({ code: value, trustDevice: true })
			);
			await cloudSession.refresh();
			onsignedin();
		});
	}

	function startSso(event: SubmitEvent) {
		event.preventDefault();
		void run(async () => {
			await unwrap(authClient.signIn.sso({ email, callbackURL: callbackURL() }));
		});
	}

	function magicLink() {
		if (!email) {
			error = "Enter your email first.";
			return;
		}
		void run(async () => {
			await unwrap(authClient.signIn.magicLink({ email, callbackURL: callbackURL() }));
			sent = `We emailed a sign-in link to ${email}.`;
		});
	}

	function resetPassword() {
		if (!email) {
			error = "Enter your email first.";
			return;
		}
		void run(async () => {
			await unwrap(
				authClient.requestPasswordReset({ email, redirectTo: appUrl("/workspace/account/reset") })
			);
			sent = `If ${email} has an account, a reset link is on its way.`;
		});
	}

	function social(provider: "google" | "github" | "gitlab") {
		void run(async () => {
			await unwrap(authClient.signIn.social({ provider, callbackURL: callbackURL() }));
		});
	}

	const PROVIDERS = {
		google: { label: "Google", icon: IconBrandGoogle },
		github: { label: "GitHub", icon: IconBrandGithub },
		gitlab: { label: "GitLab", icon: IconBrandGitlab }
	} as const;
</script>

{#if challenge}
	<form class="flex flex-col gap-3" onsubmit={confirmCode}>
		<p class="text-md">
			{backup
				? "Enter one of your backup codes."
				: "Enter the 6-digit code from your authenticator app."}
		</p>
		<Input
			required
			autocomplete="one-time-code"
			inputmode={backup ? "text" : "numeric"}
			aria-label={backup ? "Backup code" : "Authenticator code"}
			bind:value={code}
		/>
		{#if error}<p class="text-destructive-strong text-sm" role="alert">{error}</p>{/if}
		<Button type="submit" variant="dark" disabled={busy || !code.trim()}>
			{#if busy}<IconLoader2 class="animate-spin" />{/if} Verify
		</Button>
		<Button
			type="button"
			variant="ghost"
			size="sm"
			class="self-start"
			onclick={() => {
				backup = !backup;
				code = "";
				error = undefined;
			}}
		>
			{backup ? "Use my authenticator app" : "Use a backup code"}
		</Button>
	</form>
{:else if sent}
	<div class="flex flex-col gap-3" role="status">
		<p class="text-md">{sent}</p>
		<Button variant="ghost" class="self-start" onclick={() => (sent = undefined)}>Back</Button>
	</div>
{:else}
	<div class="flex flex-col gap-4">
		{#if config && config.providers.length > 0}
			<div class="flex flex-col gap-2">
				{#each config.providers as p (p)}
					{@const Icon = PROVIDERS[p].icon}
					<Button variant="outline" disabled={busy} onclick={() => social(p)}>
						<Icon /> Continue with {PROVIDERS[p].label}
					</Button>
				{/each}
			</div>
			<div class="text-muted-foreground flex items-center gap-3 text-xs">
				<Separator class="flex-1" /> or <Separator class="flex-1" />
			</div>
		{/if}

		<Tabs bind:value={mode}>
			<TabsList class="w-full">
				<TabsTrigger value="signin" class="flex-1">Sign in</TabsTrigger>
				<TabsTrigger value="signup" class="flex-1">Create account</TabsTrigger>
				<TabsTrigger value="sso" class="flex-1">SSO</TabsTrigger>
			</TabsList>
			<TabsContent value={mode}>
				{#if mode === "sso"}
					<form class="flex flex-col gap-3 pt-2" onsubmit={startSso}>
						<p class="text-muted-foreground text-sm">
							Use your organization's single sign-on. We find it from your work email.
						</p>
						<label class="flex flex-col gap-1 text-xs font-medium">
							Work email
							<Input type="email" required autocomplete="email" bind:value={email} />
						</label>
						{#if error}<p class="text-destructive-strong text-sm" role="alert">{error}</p>{/if}
						<Button type="submit" variant="dark" disabled={busy}>
							{#if busy}<IconLoader2 class="animate-spin" />{:else}<IconBuilding />{/if}
							Continue with SSO
						</Button>
					</form>
				{:else}
				<form class="flex flex-col gap-3 pt-2" onsubmit={submit}>
					{#if mode === "signup"}
						<label class="flex flex-col gap-1 text-xs font-medium">
							Name
							<Input autocomplete="name" bind:value={name} />
						</label>
					{/if}
					<label class="flex flex-col gap-1 text-xs font-medium">
						Email
						<Input type="email" required autocomplete="email" bind:value={email} />
					</label>
					<label class="flex flex-col gap-1 text-xs font-medium">
						Password
						<Input
							type="password"
							required
							minlength={10}
							autocomplete={mode === "signup" ? "new-password" : "current-password"}
							bind:value={password}
						/>
					</label>
					{#if error}
						<p class="text-destructive-strong text-sm" role="alert">{error}</p>
					{/if}
					<Button type="submit" variant="dark" disabled={busy}>
						{#if busy}<IconLoader2 class="animate-spin" />{/if}
						{mode === "signup" ? "Create account" : "Sign in"}
					</Button>
					{#if mode === "signin"}
						<div class="flex flex-wrap items-center justify-between gap-2">
							<Button type="button" variant="ghost" size="sm" disabled={busy} onclick={magicLink}>
								<IconMail /> Email me a sign-in link
							</Button>
							<Button type="button" variant="ghost" size="sm" disabled={busy} onclick={resetPassword}>
								Forgot password?
							</Button>
						</div>
					{/if}
				</form>
				{/if}
			</TabsContent>
		</Tabs>
	</div>
{/if}
