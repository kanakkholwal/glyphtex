import { renderEmail } from "@glyphtex/email";
import type { Mail } from "../adapters/types.ts";

const article = (role: string, a: string, b: string) => (role === a ? b : `a ${role}`);

export const mails = {
	verifyEmail: (to: string, url: string): Mail => ({
		to,
		subject: "Verify your GlyphTeX email",
		...renderEmail("verifyEmail", { url })
	}),
	resetPassword: (to: string, url: string): Mail => ({
		to,
		subject: "Reset your GlyphTeX password",
		...renderEmail("resetPassword", { url })
	}),
	magicLink: (to: string, url: string): Mail => ({
		to,
		subject: "Your GlyphTeX sign-in link",
		...renderEmail("magicLink", { url })
	}),
	deleteAccount: (to: string, url: string): Mail => ({
		to,
		subject: "Confirm GlyphTeX account deletion",
		...renderEmail("deleteAccount", { url })
	}),
	orgInvite: (to: string, inviter: string, orgName: string, role: string, url: string): Mail => ({
		to,
		subject: `${inviter} invited you to ${orgName} on GlyphTeX`,
		...renderEmail("orgInvite", { url, inviter, orgName, role: article(role, "admin", "an admin") })
	}),
	invite: (to: string, inviter: string, projectName: string, role: string, url: string): Mail => ({
		to,
		subject: `${inviter} shared "${projectName}" with you`,
		...renderEmail("projectInvite", {
			url,
			inviter,
			projectName,
			role: article(role, "editor", "an editor")
		})
	})
};
