import type { AuthUser } from "../auth/auth.ts";
import type { Deps } from "../context.ts";
import type { GrantableRole } from "../db/schema.ts";
import { hashToken, newId, newToken } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { mails } from "../mail/templates.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { strongerRole } from "../rbac/permissions.ts";
import { projectRepository } from "../repositories/projects.ts";
import { sharingRepository } from "../repositories/sharing.ts";

export function sharingService({ db, adapters, config }: Deps) {
	const sharing = sharingRepository(db);
	const projects = projectRepository(db);
	const hours = (h: number) => new Date(Date.now() + h * 3_600_000);

	/** Adds or upgrades a member; owners and stronger existing roles are left alone. */
	async function join(projectId: string, userId: string, role: GrantableRole) {
		const found = await projects.findWithRole(projectId, userId);
		if (!found) throw errors.notFound("Project");
		if (found.role === "owner") return "owner" as const;
		const next = found.role ? strongerRole(found.role, role) : role;
		await sharing.upsertMember(projectId, userId, next);
		return next;
	}

	return {
		async members({ project }: ProjectAccess) {
			const owner = await db.query.user.findFirst({
				where: (u, { eq }) => eq(u.id, project.ownerId),
				columns: { id: true, name: true, email: true, image: true }
			});
			return {
				owner: owner && {
					userId: owner.id,
					name: owner.name,
					email: owner.email,
					image: owner.image
				},
				members: await sharing.listMembers(project.id)
			};
		},

		async setRole({ project }: ProjectAccess, userId: string, role: GrantableRole) {
			if (!(await sharing.getMemberRole(project.id, userId))) throw errors.notFound("Member");
			await sharing.upsertMember(project.id, userId, role);
		},

		/** Owners/sharers remove anyone; any member may remove themselves (leave). */
		async removeMember(access: ProjectAccess, actorId: string, userId: string, canShare: boolean) {
			if (userId !== actorId && !canShare) throw errors.forbidden();
			if (userId === access.project.ownerId) {
				throw errors.badRequest("The owner can't leave their own project.");
			}
			if (!(await sharing.removeMember(access.project.id, userId))) throw errors.notFound("Member");
		},

		async invite(access: ProjectAccess, inviter: AuthUser, email: string, role: GrantableRole) {
			const normalized = email.trim().toLowerCase();
			if (normalized === inviter.email.toLowerCase()) {
				throw errors.badRequest("You already have access to this project.");
			}
			const token = newToken();
			const invite = await sharing.upsertInvite({
				id: newId(),
				projectId: access.project.id,
				email: normalized,
				role,
				tokenHash: await hashToken(token),
				invitedBy: inviter.id,
				expiresAt: hours(config.limits.inviteTtlHours)
			});
			const url = `${config.appUrl}/invite/${encodeURIComponent(token)}`;
			await adapters.queue.enqueue({
				type: "email.send",
				mail: mails.invite(
					normalized,
					inviter.name || inviter.email,
					access.project.name,
					role,
					url
				)
			});
			return { id: invite?.id, email: normalized, role, expiresAt: invite?.expiresAt };
		},

		listInvites: ({ project }: ProjectAccess) => sharing.listInvites(project.id),

		async revokeInvite({ project }: ProjectAccess, id: string) {
			if (!(await sharing.deleteInvite(project.id, id))) throw errors.notFound("Invite");
		},

		/** Invites are bound to an email; only a verified account with that address can accept. */
		async acceptInvite(user: AuthUser, token: string) {
			const invite = await sharing.findInviteByHash(await hashToken(token));
			if (!invite) throw errors.notFound("Invite");
			if (invite.expiresAt < new Date()) throw errors.gone("This invite has expired.");
			if (!user.emailVerified || user.email.toLowerCase() !== invite.email) {
				throw errors.forbidden(
					`This invite was sent to ${invite.email}. Sign in with that address.`
				);
			}
			const role = await join(invite.projectId, user.id, invite.role);
			await sharing.deleteInvite(invite.projectId, invite.id);
			return { projectId: invite.projectId, role };
		},

		async createLink(
			access: ProjectAccess,
			userId: string,
			role: GrantableRole,
			expiresInHours?: number
		) {
			const token = newToken();
			const link = await sharing.createLink({
				id: newId(),
				projectId: access.project.id,
				role,
				tokenHash: await hashToken(token),
				createdBy: userId,
				expiresAt: expiresInHours ? hours(expiresInHours) : null
			});
			// The token is only ever returned here; the server keeps just its hash.
			return {
				...link,
				tokenHash: undefined,
				url: `${config.appUrl}/join/${encodeURIComponent(token)}`
			};
		},

		listLinks: ({ project }: ProjectAccess) => sharing.listLinks(project.id),

		async revokeLink({ project }: ProjectAccess, id: string) {
			if (!(await sharing.deleteLink(project.id, id))) throw errors.notFound("Link");
		},

		async redeemLink(userId: string, token: string) {
			const link = await sharing.findActiveLinkByHash(await hashToken(token));
			if (!link) throw errors.notFound("Link");
			const role = await join(link.projectId, userId, link.role);
			return { projectId: link.projectId, role };
		}
	};
}
