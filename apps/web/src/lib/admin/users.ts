/** What the instance admin sees of an account; a subset of Better Auth's admin user. */
export interface AdminUser {
	id: string;
	name: string;
	email: string;
	emailVerified: boolean;
	role?: string | null;
	banned?: boolean | null;
	banReason?: string | null;
	createdAt: Date | string;
}

export type UserAction =
	| "make-admin"
	| "remove-admin"
	| "ban"
	| "unban"
	| "impersonate"
	| "sign-out"
	| "delete";
