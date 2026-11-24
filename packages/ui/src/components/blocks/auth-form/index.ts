export { default as AuthForm } from "./auth-form.svelte";
export {
	type AuthMode,
	type AuthStep,
	type AuthStatus,
	type AuthDetails,
	type AuthProviderEntry,
	AUTH_COPY,
	authProblems,
	resendSeconds
} from "./auth";
export { authForm, type AuthFormVariant } from "./variants";
export { default as Root } from "./auth-form.svelte";
