import type { Mail } from "../adapters/types.ts";

const escapeHtml = (s: string) =>
	s.replace(
		/[&<>"']/g,
		(c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot", "'": "#39" }[c]};`
	);

function actionMail(
	to: string,
	subject: string,
	lines: string[],
	action: string,
	url: string
): Mail {
	const text = [
		...lines,
		"",
		`${action}: ${url}`,
		"",
		"If you didn't expect this email, ignore it."
	].join("\n");
	const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">${lines
		.map((l) => `<p>${escapeHtml(l)}</p>`)
		.join(
			""
		)}<p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p><p style="color:#666">If you didn't expect this email, ignore it.</p></div>`;
	return { to, subject, text, html };
}

export const mails = {
	verifyEmail: (to: string, url: string) =>
		actionMail(
			to,
			"Verify your GlyphTeX email",
			["Confirm this address to finish signing up."],
			"Verify email",
			url
		),
	resetPassword: (to: string, url: string) =>
		actionMail(
			to,
			"Reset your GlyphTeX password",
			["Someone asked to reset your password."],
			"Reset password",
			url
		),
	magicLink: (to: string, url: string) =>
		actionMail(
			to,
			"Your GlyphTeX sign-in link",
			["This link signs you in and expires soon."],
			"Sign in",
			url
		),
	deleteAccount: (to: string, url: string) =>
		actionMail(
			to,
			"Confirm GlyphTeX account deletion",
			[
				"This permanently deletes your account, every project you own and all their files.",
				"It cannot be undone."
			],
			"Delete my account",
			url
		),
	orgInvite: (to: string, inviter: string, orgName: string, role: string, url: string) =>
		actionMail(
			to,
			`${inviter} invited you to ${orgName} on GlyphTeX`,
			[
				`${inviter} invited you to join ${orgName} as ${role === "admin" ? "an admin" : `a ${role}`}.`
			],
			"Join organization",
			url
		),
	invite: (to: string, inviter: string, projectName: string, role: string, url: string) =>
		actionMail(
			to,
			`${inviter} shared "${projectName}" with you`,
			[
				`${inviter} invited you to "${projectName}" as ${role === "editor" ? "an editor" : `a ${role}`}.`
			],
			"Open project",
			url
		)
};
