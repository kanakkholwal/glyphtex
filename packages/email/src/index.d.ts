export type TemplateName =
	| "verifyEmail"
	| "resetPassword"
	| "magicLink"
	| "deleteAccount"
	| "orgInvite"
	| "projectInvite";

/** Fills `{{tokens}}` in a pre-rendered mail; values are HTML-escaped in the html part only. */
export function renderEmail(
	name: TemplateName,
	values: Record<string, string>
): { html: string; text: string };
