/** The slice of the signed-in user the UI reads; the server session helper and the client store share it. */
export interface SessionUser {
	id: string;
	name: string;
	email: string;
	image: string | null;
	twoFactorEnabled: boolean;
	/** `admin` runs the instance; everyone else is `user`. */
	role: string;
	emailVerified: boolean;
}

export interface SessionOrg {
	id: string;
	name: string;
	slug: string;
	logo?: string | null;
}

export const toSessionUser = (u: {
	id: string;
	name: string;
	email: string;
	image?: string | null;
	twoFactorEnabled?: boolean | null;
	role?: string | null;
	emailVerified?: boolean | null;
}): SessionUser => ({
	id: u.id,
	name: u.name,
	email: u.email,
	image: u.image ?? null,
	twoFactorEnabled: u.twoFactorEnabled === true,
	role: u.role ?? "user",
	emailVerified: u.emailVerified === true
});
