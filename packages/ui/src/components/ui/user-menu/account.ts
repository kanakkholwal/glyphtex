export type UserStatus = "available" | "busy" | "away";
export type ThemePreference = "light" | "dark" | "system";

export type UserMenuUser = {
	name: string;
	email: string;
	/** A short badge beside the name, such as "Pro". */
	plan?: string;
	avatar?: string;
};

/** Statuses in menu order; each dot has its own shape as well as colour. */
export const USER_STATUSES: { value: UserStatus; label: string }[] = [
	{ value: "available", label: "Available" },
	{ value: "busy", label: "Busy" },
	{ value: "away", label: "Away" },
];

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: string }[] = [
	{
		value: "light",
		label: "Light",
		icon: "M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
	},
	{ value: "dark", label: "Dark", icon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" },
	{ value: "system", label: "System", icon: "M4 4h16v12H4zM8 20h8m-4-4v4" },
];

export const statusLabel = (status: UserStatus) =>
	USER_STATUSES.find((option) => option.value === status)?.label ?? status;

/** Runs sign out; a returned promise keeps the menu open with progress until it settles. */
export async function runSignOut(
	onSignOut: (() => unknown) | undefined,
	setPending: (pending: boolean) => void,
) {
	const result = onSignOut?.();
	if (!(result instanceof Promise)) return;
	setPending(true);
	try {
		await result;
	} finally {
		setPending(false);
	}
}
