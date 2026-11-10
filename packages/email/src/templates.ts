/** Static copy per mail. `{{name}}` tokens are filled at send time; see index.ts. */
export interface TemplateCopy {
	preview: string;
	eyebrow: string;
	heading: string;
	lines: string[];
	action: string;
}

export const TEMPLATES: Record<string, TemplateCopy> = {
	verifyEmail: {
		preview: "Confirm your email to finish signing up.",
		eyebrow: "Verify email",
		heading: "Confirm your email",
		lines: ["Confirm this address to finish signing up for GlyphTeX."],
		action: "Verify email"
	},
	resetPassword: {
		preview: "Choose a new GlyphTeX password.",
		eyebrow: "Password reset",
		heading: "Reset your password",
		lines: [
			"Someone asked to reset your password.",
			"Didn't request this? Ignore this email and your password stays the same."
		],
		action: "Reset password"
	},
	magicLink: {
		preview: "Your GlyphTeX sign-in link.",
		eyebrow: "Sign in",
		heading: "Your sign-in link",
		lines: ["This link signs you in and expires soon. It works once."],
		action: "Sign in"
	},
	deleteAccount: {
		preview: "Confirm deleting your GlyphTeX account.",
		eyebrow: "Account deletion",
		heading: "Confirm account deletion",
		lines: [
			"This permanently deletes your account, every project you own and all their files.",
			"It cannot be undone. If you didn't ask for this, ignore this email."
		],
		action: "Delete my account"
	},
	orgInvite: {
		preview: "{{inviter}} invited you to {{orgName}}.",
		eyebrow: "Organization invite",
		heading: "Join {{orgName}}",
		lines: ["{{inviter}} invited you to join {{orgName}} as {{role}}."],
		action: "Join organization"
	},
	projectInvite: {
		preview: "{{inviter}} shared a project with you.",
		eyebrow: "Project invite",
		heading: "{{projectName}}",
		lines: ['{{inviter}} invited you to "{{projectName}}" as {{role}}.'],
		action: "Open project"
	}
};
