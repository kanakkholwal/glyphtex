export type AuthMode = "sign-in" | "sign-up";
export type AuthStep = "details" | "code";
export type AuthStatus = "idle" | "submitting" | "error";

export interface AuthDetails {
	email: string;
	/** Sign-up only. */
	name?: string;
	/** Sign-up only. */
	password?: string;
	/** Sign-up only: the product updates checkbox. */
	updates?: boolean;
}

export interface AuthProviderEntry {
	id: string;
	label: string;
}

export const AUTH_COPY = {
	"sign-in": {
		title: "Welcome back",
		description: "Sign in with your work email. We'll send a code.",
		submit: "Continue with email",
		switchPrompt: "New here?",
		switchAction: "Create an account"
	},
	"sign-up": {
		title: "Create your account",
		description: "Start free; no card needed.",
		submit: "Create account",
		switchPrompt: "Already have an account?",
		switchAction: "Sign in"
	}
} as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Field problems for the current mode; an empty object means the details can be sent. */
export function authProblems(mode: AuthMode, details: AuthDetails) {
	const problems: Partial<Record<"email" | "name" | "password", string>> = {};
	if (!EMAIL.test(details.email.trim()))
		problems.email = "Enter a full address, like name@example.com.";
	if (mode === "sign-up") {
		if ((details.name ?? "").trim().length < 2) problems.name = "Enter your full name.";
		if ((details.password ?? "").length < 8) problems.password = "Use at least 8 characters.";
	}
	return problems;
}

/** Whole seconds until a resend opens, never below zero. */
export const resendSeconds = (resendAt: number | undefined, now: number) =>
	resendAt === undefined ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
