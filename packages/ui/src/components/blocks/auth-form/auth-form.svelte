<script lang="ts">
	import type { Snippet } from "svelte";
	import Button from "../../ui/button/button.svelte";
	import Checkbox from "../../ui/checkbox/checkbox.svelte";
	import Field from "../../ui/field/field.svelte";
	import FieldError from "../../ui/field/field-error.svelte";
	import FieldLabel from "../../ui/field/field-label.svelte";
	import FieldSeparator from "../../ui/field/field-separator.svelte";
	import Input from "../../ui/input/input.svelte";
	import InputOTP from "../../ui/input-otp/input-otp.svelte";
	import InputOTPGroup from "../../ui/input-otp/input-otp-group.svelte";
	import InputOTPSlot from "../../ui/input-otp/input-otp-slot.svelte";
	import { cn } from "../../../lib/cn.js";
	import PasswordInput from "../../ui/password-input/password-input.svelte";
	import {
		AUTH_COPY,
		type AuthDetails,
		type AuthMode,
		type AuthProviderEntry,
		type AuthStatus,
		type AuthStep,
		authProblems,
		resendSeconds
	} from "./auth";
	import { type AuthFormVariant, authForm } from "./variants";

	let {
		onSubmit,
		variant = "card",
		mode = $bindable(),
		onModeChange,
		step = "details",
		onBack,
		status = "idle",
		error,
		onCode,
		onResend,
		resendAt,
		codeLength = 6,
		providers = [],
		onProvider,
		pendingProvider,
		onPasskey,
		brand,
		title,
		description,
		legal,
		class: className
	}: {
		/** Called with valid details; move `step` to "code" once a code is sent, or finish the sign-in. */
		onSubmit: (details: AuthDetails) => void;
		/** `card` frames the form on a bordered surface; `plain` sits on the page. */
		variant?: AuthFormVariant;
		/** Bindable. */
		mode?: AuthMode;
		onModeChange?: (mode: AuthMode) => void;
		step?: AuthStep;
		/** Back from the code step. */
		onBack?: () => void;
		status?: AuthStatus;
		/** Shown when `status` is "error"; field values are kept. */
		error?: string;
		/** Called once every code digit is in. */
		onCode?: (code: string) => void;
		onResend?: () => void;
		/** Epoch ms when a new code may be requested. */
		resendAt?: number;
		codeLength?: number;
		providers?: (AuthProviderEntry & { icon?: Snippet })[];
		onProvider?: (id: string) => void;
		/** The provider whose redirect is in flight. */
		pendingProvider?: string;
		/** Shows "Sign in with a passkey" in sign-in mode. */
		onPasskey?: () => void;
		brand?: Snippet;
		title?: string;
		description?: string;
		/** Under the form, e.g. terms and privacy links. */
		legal?: Snippet;
		class?: string;
	} = $props();

	const uid = $props.id();
	const s = $derived(authForm({ variant }));
	let ownMode = $state<AuthMode>("sign-in");
	const active = $derived(mode ?? ownMode);
	const copy = $derived(AUTH_COPY[active]);
	const signUp = $derived(active === "sign-up");
	let name = $state("");
	let email = $state("");
	let password = $state("");
	let updates = $state(false);
	let tried = $state(false);
	let code = $state("");
	let now = $state(Date.now());
	const busy = $derived(status === "submitting");
	const problems = $derived(tried ? authProblems(active, { name, email, password }) : {});
	const wait = $derived(resendSeconds(resendAt, now));

	// A one-second clock for the resend countdown, only while one is pending.
	$effect(() => {
		if (step !== "code" || resendAt === undefined) return;
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	$effect(() => {
		if (step === "details") code = "";
	});

	function switchMode() {
		const next = active === "sign-in" ? "sign-up" : "sign-in";
		if (mode === undefined) ownMode = next;
		else mode = next;
		onModeChange?.(next);
		tried = false;
	}
	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (busy) return;
		tried = true;
		if (Object.keys(authProblems(active, { name, email, password })).length) return;
		onSubmit(
			signUp
				? { name: name.trim(), email: email.trim(), password, updates }
				: { email: email.trim() }
		);
	}
</script>

<div data-slot="auth-form" data-variant={variant} data-mode={active} class={cn(s.root(), className)}>
	<header class={s.header()}>
		{#if brand}<div class={s.brand()}>{@render brand()}</div>{/if}
		<h1 id="{uid}-title" class={s.title()}>{step === "code" ? "Check your email" : (title ?? copy.title)}</h1>
		<p class={s.description()}>
			{step === "code" ? `We sent a ${codeLength}-digit code.` : (description ?? copy.description)}
		</p>
	</header>
	<div class={s.stage()}>
		<div data-active={step === "details"} inert={step !== "details"} class={s.step()}>
			<div class={s.stepInner()}>
				<form novalidate aria-labelledby="{uid}-title" onsubmit={submit} class={s.form()}>
					{#if providers.length || onPasskey}
						<div class={s.providers()}>
							{#each providers as provider (provider.id)}
								<Button
									type="button"
									variant="outline"
									loading={pendingProvider === provider.id}
									disabled={busy || (pendingProvider !== undefined && pendingProvider !== provider.id)}
									onclick={() => onProvider?.(provider.id)}
								>
									{#if provider.icon}<span class={s.providerIcon()}>{@render provider.icon()}</span>{/if}
									Continue with {provider.label}
								</Button>
							{/each}
							{#if onPasskey && !signUp}
								<Button type="button" variant="outline" disabled={busy} onclick={onPasskey}>Sign in with a passkey</Button>
							{/if}
						</div>
						<FieldSeparator>or</FieldSeparator>
					{/if}
					<div data-open={signUp} inert={!signUp} class={s.fold()}>
						<div class={s.foldInner()}>
							<Field data-invalid={Boolean(problems.name)}>
								<FieldLabel for="{uid}-name">Full name</FieldLabel>
								<Input id="{uid}-name" autocomplete="name" bind:value={name} invalid={Boolean(problems.name)} />
								{#if problems.name}<FieldError>{problems.name}</FieldError>{/if}
							</Field>
						</div>
					</div>
					<Field data-invalid={Boolean(problems.email)}>
						<FieldLabel for="{uid}-email">Email</FieldLabel>
						<Input
							id="{uid}-email"
							type="email"
							inputmode="email"
							autocomplete="email"
							placeholder="you@company.com"
							bind:value={email}
							invalid={Boolean(problems.email)}
						/>
						{#if problems.email}<FieldError>{problems.email}</FieldError>{/if}
					</Field>
					<div data-open={signUp} inert={!signUp} class={s.fold()}>
						<div class={s.foldInner()}>
							<Field data-invalid={Boolean(problems.password)}>
								<PasswordInput label="Password" autocomplete="new-password" bind:value={password} />
								{#if problems.password}<FieldError>{problems.password}</FieldError>{/if}
							</Field>
							<Checkbox label="Send me product updates" bind:checked={updates} />
						</div>
					</div>
					{#if status === "error" && error && step === "details"}<p role="alert" class={s.error()}>{error}</p>{/if}
					<Button type="submit" loading={busy}>{copy.submit}</Button>
				</form>
			</div>
		</div>
		<div data-active={step === "code"} inert={step !== "code"} class={s.step()}>
			<div class={s.stepInner()}>
				<div class={s.form()}>
					<p class={s.codeIntro()}>Enter it below. It went to <span class={s.codeEmail()}>{email.trim()}</span>.</p>
					<div class={s.codeField()}>
						<InputOTP
							maxlength={codeLength}
							bind:value={code}
							invalid={status === "error"}
							onComplete={(value: string) => onCode?.(value)}
							disabled={busy}
							aria-label="One-time code"
						>
							{#snippet children({ cells })}
								<InputOTPGroup>
									{#each cells as cell, i (i)}<InputOTPSlot {cell} />{/each}
								</InputOTPGroup>
							{/snippet}
						</InputOTP>
					</div>
					{#if status === "error" && error && step === "code"}<p role="alert" class={s.error()}>{error}</p>{/if}
					<p class={s.resend()} aria-live="polite">
						{#if wait > 0}
							Resend a code in {wait}s
						{:else}
							<Button variant="link" size="xs" onclick={onResend} disabled={busy}>Resend the code</Button>
						{/if}
					</p>
					{#if onBack}<Button variant="ghost" size="sm" onclick={onBack}>Use a different email</Button>{/if}
				</div>
			</div>
		</div>
	</div>
	{#if step === "details"}
		<p class={s.footer()}>
			{copy.switchPrompt}
			<Button variant="link" size="xs" onclick={switchMode}>{copy.switchAction}</Button>
		</p>
	{/if}
	{#if legal}<div class={s.legal()}>{@render legal()}</div>{/if}
</div>
