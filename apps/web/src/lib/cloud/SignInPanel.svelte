<script lang="ts">
	import { Button } from "@glyphtex/ui/button";
	import { Field, FieldError, FieldLabel } from "@glyphtex/ui/field";
	import { Input } from "@glyphtex/ui/input";
	import { InputOTP, InputOTPGroup, InputOTPSlot } from "@glyphtex/ui/input-otp";
	import { PasswordInput, passwordRules } from "@glyphtex/ui/password-input";
	import { Separator } from "@glyphtex/ui/separator";
	import { Skeleton } from "@glyphtex/ui/skeleton";
	import {
		IconBrandGithub,
		IconBrandGitlab,
		IconBrandGoogle,
		IconBuilding,
		IconFingerprint,
		IconId,
		IconLoader2,
		IconMail
	} from "@tabler/icons-svelte";
	import { onMount } from "svelte";
	import { prefersReducedMotion } from "svelte/motion";
	import { fly } from "svelte/transition";
	import { goto } from "$app/navigation";
	import { page } from "$app/state";

	import EmailOnlyForm from "./EmailOnlyForm.svelte";
	import type { PublicConfig } from "./api";
	import { appUrl, authClient, unwrap } from "./auth";
	import { publicConfig } from "./public-config";
	import { cloudSession } from "./session.svelte";

	interface Props {
		/** Where to land after signing in (already validated by the caller). */
		next: string;
		onsignedin: () => void;
	}

	let { next, onsignedin }: Props = $props();

	let config = $state<PublicConfig | undefined>(undefined);
	/** Until the config settles the provider area is a skeleton, so the form doesn't shift when it lands. */
	let configLoaded = $state(false);
	// Assume mail works until the config says otherwise.
	const mailOn = $derived(config?.features.mail ?? true);
	type Mode = "signin" | "signup" | "sso" | "forgot" | "magic";
	const MODES: readonly Mode[] = ["signin", "signup", "sso", "forgot", "magic"];
	// The mode and email live in the URL, so a view can be linked, reloaded and reached with Back.
	const mode = $derived.by<Mode>(() => {
		const value = page.url.searchParams.get("mode");
		return MODES.find((m) => m === value) ?? "signin";
	});
	function setMode(target: Mode) {
		const url = new URL(page.url);
		if (target === "signin") url.searchParams.delete("mode");
		else url.searchParams.set("mode", target);
		error = undefined;
		void goto(url, { replaceState: true, keepFocus: true, noScroll: true });
	}
	/** Set once the password was right but the account has an authenticator to confirm. */
	let challenge = $state(false);
	let code = $state("");
	let backup = $state(false);
	let name = $state("");
	let email = $state(page.url.searchParams.get("email") ?? "");
	let password = $state("");
	let busy = $state(false);
	let error = $state<string | undefined>(undefined);
	/** Set once a mail went out, so the form gives way to "check your inbox". */
	let sent = $state<string | undefined>(undefined);

	onMount(async () => {
		try {
			config = await publicConfig();
		} catch {
			// Without config we still offer email sign-in, which every server supports.
		} finally {
			configLoaded = true;
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

	function confirmCode(event?: SubmitEvent) {
		event?.preventDefault();
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
				authClient.requestPasswordReset({ email, redirectTo: appUrl("/workspace/sign-in/reset") })
			);
			sent = `If ${email} has an account, a reset link is on its way.`;
		});
	}

	function passkeySignIn() {
		void run(async () => {
			await unwrap(authClient.signIn.passkey());
			await cloudSession.refresh();
			onsignedin();
		});
	}

	function social(provider: PublicConfig["providers"][number]) {
		void run(async () => {
			await unwrap(authClient.signIn.social({ provider, callbackURL: callbackURL() }));
		});
	}

	const PROVIDERS = {
		google: { label: "Google", icon: IconBrandGoogle },
		github: { label: "GitHub", icon: IconBrandGithub },
		gitlab: { label: "GitLab", icon: IconBrandGitlab },
		orcid: { label: "ORCID", icon: IconId }
	} as const;

	// The server enforces length only, so the meter checks length only; more rules would promise what is not required.
	const rules = passwordRules(10).slice(0, 1);
	const enter = () => ({ y: prefersReducedMotion.current ? 0 : 6, duration: 160 });
</script>

{#snippet failure()}
	{#if error}<FieldError role="alert">{error}</FieldError>{/if}
{/snippet}

{#if challenge}
	<form class="flex flex-col gap-4" onsubmit={confirmCode} in:fly={enter()}>
		{#if backup}
			<Field>
				<FieldLabel for="backup-code">Backup code</FieldLabel>
				<Input id="backup-code" required autocomplete="one-time-code" bind:value={code} />
			</Field>
		{:else}
			<Field>
				<FieldLabel for="totp">6-digit code from your authenticator app</FieldLabel>
				<InputOTP
					id="totp"
					maxlength={6}
					bind:value={code}
					invalid={error !== undefined}
					autocomplete="one-time-code"
					onComplete={() => confirmCode()}
				>
					{#snippet children({ cells })}
						<InputOTPGroup>
							{#each cells as cell, i (i)}<InputOTPSlot {cell} />{/each}
						</InputOTPGroup>
					{/snippet}
				</InputOTP>
			</Field>
		{/if}
		{@render failure()}
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
	<div class="flex flex-col gap-4" role="status" in:fly={enter()}>
		<p class="text-base text-pretty">{sent}</p>
		<p class="text-muted-foreground text-sm">The link works once and expires after an hour.</p>
		<Button variant="ghost" class="self-start" onclick={() => (sent = undefined)}>Back</Button>
	</div>
{:else if mode === "forgot"}
	<div in:fly={enter()}>
		<EmailOnlyForm
			description="Enter your email and we'll send a link to choose a new password."
			submitLabel="Send reset link"
			bind:email
			{busy}
			{error}
			onsubmit={resetPassword}
			onback={() => setMode("signin")}
		/>
	</div>
{:else if mode === "magic"}
	<div in:fly={enter()}>
		<EmailOnlyForm
			description="We'll email you a link that signs you in. No password needed."
			submitLabel="Email me a sign-in link"
			bind:email
			{busy}
			{error}
			onsubmit={magicLink}
			onback={() => setMode("signin")}
		>
			{#snippet icon()}<IconMail />{/snippet}
		</EmailOnlyForm>
	</div>
{:else if mode === "sso"}
	<form class="flex flex-col gap-4" onsubmit={startSso} in:fly={enter()}>
		<Field>
			<FieldLabel for="sso-email">Work email</FieldLabel>
			<Input
				id="sso-email"
				type="email"
				required
				autocomplete="email"
				placeholder="you@yourcompany.com"
				bind:value={email}
			/>
			<p class="text-muted-foreground text-xs">We find your organization's sign-in from the domain.</p>
		</Field>
		{@render failure()}
		<Button type="submit" variant="dark" disabled={busy}>
			{#if busy}<IconLoader2 class="animate-spin" />{:else}<IconBuilding />{/if}
			Continue with single sign-on
		</Button>
		<Button type="button" variant="ghost" size="sm" class="self-start" onclick={() => setMode("signin")}>
			Back to sign in
		</Button>
	</form>
{:else}
	<div class="flex flex-col gap-6" in:fly={enter()}>
		{#if !configLoaded}
			<div class="grid grid-cols-2 gap-2" role="status" aria-busy="true" aria-label="Loading sign-in options">
				<Skeleton class="h-10 rounded-lg" />
				<Skeleton class="h-10 rounded-lg" />
			</div>
		{:else if config && config.providers.length > 0}
			<div class="grid gap-2 {config.providers.length > 1 ? 'grid-cols-2' : ''}">
				{#each config.providers as p (p)}
					{@const Icon = PROVIDERS[p].icon}
					<Button variant="outline" disabled={busy} onclick={() => social(p)}>
						<Icon /> {PROVIDERS[p].label}
					</Button>
				{/each}
			</div>
		{/if}
		{#if mode === "signin"}
			<Button type="button" variant="outline" disabled={busy} onclick={passkeySignIn}>
				<IconFingerprint /> Use a passkey
			</Button>
		{/if}
		{#if configLoaded && ((config && config.providers.length > 0) || mode === "signin")}
			<div class="text-muted-foreground flex items-center gap-3 text-xs">
				<Separator class="flex-1" /> or with email <Separator class="flex-1" />
			</div>
		{/if}

		<form class="flex flex-col gap-4" onsubmit={submit}>
			{#if mode === "signup"}
				<Field>
					<FieldLabel for="name">Name</FieldLabel>
					<Input id="name" autocomplete="name" placeholder="Your name" bind:value={name} />
				</Field>
			{/if}
			<Field>
				<FieldLabel for="email">Email</FieldLabel>
				<Input id="email" type="email" required autocomplete="email" placeholder="you@example.com" bind:value={email} />
			</Field>
			<Field>
				<div class="flex items-center justify-between">
					<FieldLabel for="password">Password</FieldLabel>
					{#if mode === "signin" && mailOn}
						<button
							type="button"
							class="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
							onclick={() => setMode("forgot")}
						>
							Forgot password?
						</button>
					{/if}
				</div>
				<PasswordInput
					id="password"
					label="Password"
					required
					minlength={10}
					bind:value={password}
					rules={mode === "signup" ? rules : undefined}
					placeholder={mode === "signup" ? "At least 10 characters" : "Your password"}
					autocomplete={mode === "signup" ? "new-password" : "current-password"}
				/>
			</Field>
			{@render failure()}
			<Button type="submit" variant="dark" disabled={busy}>
				{#if busy}<IconLoader2 class="animate-spin" />{/if}
				{mode === "signup" ? "Create account" : "Sign in"}
			</Button>
			{#if mode === "signup"}
				<p class="text-muted-foreground text-xs text-pretty">
					By creating an account you agree to the <a class="underline underline-offset-4" href="/privacy">privacy policy</a>.
				</p>
			{/if}
		</form>

		<div class="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
			{#if mode === "signin"}
				<span>New to GlyphTeX? <button type="button" class="text-foreground underline underline-offset-4" onclick={() => setMode("signup")}>Create an account</button></span>
			{:else}
				<span>Have an account? <button type="button" class="text-foreground underline underline-offset-4" onclick={() => setMode("signin")}>Sign in</button></span>
			{/if}
		</div>
		<div class="-ml-2.5 flex flex-wrap gap-2">
			{#if mailOn}
				<Button type="button" variant="ghost" size="sm" disabled={busy} onclick={() => setMode("magic")}>
					<IconMail /> Email me a link
				</Button>
			{/if}
			<Button type="button" variant="ghost" size="sm" disabled={busy} onclick={() => setMode("sso")}>
				<IconBuilding /> Single sign-on
			</Button>
		</div>
	</div>
{/if}
