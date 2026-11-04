import type { AuthUser } from "../auth/auth.ts";
import type { Deps } from "../context.ts";
import type { GrantableRole } from "../db/schema.ts";
import { hashToken, newId, newToken } from "../lib/crypto.ts";
import { errors } from "../lib/errors.ts";
import { mails } from "../mail/templates.ts";
import type { ProjectAccess } from "../rbac/authorize.ts";
import { strongerRole } from "../rbac/permissions.ts";
import type { Feature } from "../db/schema.ts";
import { type AuditInput, orgRepository } from "../repositories/orgs.ts";
import { type ProjectRow, projectRepository } from "../repositories/projects.ts";
import { featuresFor } from "./orgs.ts";
import { sharingRepository } from "../repositories/sharing.ts";

export function sharingService({ db, adapters, config }: Deps) {
	const sharing = sharingRepository(db);
	const projects = projectRepository(db);
	const hours = (h: number) => new Date(Date.now() + h * 3_600_000);

	/** Org projects keep an audit trail; personal ones don't. */
	async function audit(project: ProjectRow, event: Omit<AuditInput, "organizationId">) {
		if (project.organizationId) {
			await orgRepository(db).audit({ organizationId: project.organizationId, ...event });
		}
	}

	/** Org policy (with the member's override) can switch a sharing feature off. */
	async function requireFeature(
		project: ProjectRow,
		userId: string,
		feature: Feature,
		message: string
	) {
		if (!project.organizationId) return;
		const { features } = await featuresFor({ db }, project.organizationId, userId);
		if (!features[feature]) throw errors.forbidden(message);
	}

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
					role: "owner" as const,
					userId: owner.id,
					name: owner.name,
					email: owner.email,
					image: owner.image
				},
				members: await sharing.listMembers(project.id)
			};
		},

		async setRole(
			{ project }: ProjectAccess,
			actorId: string,
			userId: string,
			role: GrantableRole
		) {
			const before = await sharing.getMemberRole(project.id, userId);
			if (!before) throw errors.notFound("Member");
			await sharing.upsertMember(project.id, userId, role);
			await audit(project, {
				actorId,
				action: "project.member_role_changed",
				targetType: "project",
				targetId: project.id,
				meta: { userId, from: before, to: role }
			});
		},

		/** Owners/sharers remove anyone; any member may remove themselves (leave). */
		async removeMember(access: ProjectAccess, actorId: string, userId: string, canShare: boolean) {
			if (userId !== actorId && !canShare) throw errors.forbidden();
			if (userId === access.project.ownerId) {
				throw errors.badRequest("The owner can't leave their own project.");
			}
			if (!(await sharing.removeMember(access.project.id, userId))) throw errors.notFound("Member");
			await audit(access.project, {
				actorId,
				action: userId === actorId ? "project.member_left" : "project.member_removed",
				targetType: "project",
				targetId: access.project.id,
				meta: { userId }
			});
		},

		async invite(access: ProjectAccess, inviter: AuthUser, email: string, role: GrantableRole) {
			const normalized = email.trim().toLowerCase();
			if (normalized === inviter.email.toLowerCase()) {
				throw errors.badRequest("You already have access to this project.");
			}
			if (
				access.project.organizationId &&
				!(await orgRepository(db).isMemberByEmail(access.project.organizationId, normalized))
			) {
				await requireFeature(
					access.project,
					inviter.id,
					"externalInvites",
					"Your organization only allows sharing with its own members."
				);
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
			await audit(access.project, {
				actorId: inviter.id,
				action: "project.invite_sent",
				targetType: "project",
				targetId: access.project.id,
				meta: { inviteId: invite?.id ?? null, role }
			});
			return { id: invite?.id, email: normalized, role, expiresAt: invite?.expiresAt };
		},

		listInvites: ({ project }: ProjectAccess) => sharing.listInvites(project.id),

		async revokeInvite({ project }: ProjectAccess, actorId: string, id: string) {
			if (!(await sharing.deleteInvite(project.id, id))) throw errors.notFound("Invite");
			await audit(project, {
				actorId,
				action: "project.invite_revoked",
				targetType: "project",
				targetId: project.id,
				meta: { inviteId: id }
			});
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
			await requireFeature(
				access.project,
				userId,
				"shareLinks",
				"Your organization has turned off share links."
			);
			const token = newToken();
			const link = await sharing.createLink({
				id: newId(),
				projectId: access.project.id,
				role,
				tokenHash: await hashToken(token),
				createdBy: userId,
				expiresAt: expiresInHours ? hours(expiresInHours) : null
			});
			await audit(access.project, {
				actorId: userId,
				action: "project.link_created",
				targetType: "project",
				targetId: access.project.id,
				meta: { linkId: link?.id ?? null, role }
			});
			// The token is only ever returned here; the server keeps just its hash.
			return {
				...link,
				tokenHash: undefined,
				url: `${config.appUrl}/join/${encodeURIComponent(token)}`
			};
		},

		listLinks: ({ project }: ProjectAccess) => sharing.listLinks(project.id),

		async revokeLink({ project }: ProjectAccess, actorId: string, id: string) {
			if (!(await sharing.deleteLink(project.id, id))) throw errors.notFound("Link");
			await audit(project, {
				actorId,
				action: "project.link_revoked",
				targetType: "project",
				targetId: project.id,
				meta: { linkId: id }
			});
		},

		async redeemLink(userId: string, token: string) {
			const link = await sharing.findActiveLinkByHash(await hashToken(token));
			if (!link) throw errors.notFound("Link");
			// A link stops working once its org turns links off for the person who made it.
			const linked = await projects.findWithRole(link.projectId, link.createdBy);
			if (linked) {
				await requireFeature(
					linked.project,
					link.createdBy,
					"shareLinks",
					"This organization has turned off share links."
				);
			}
			const role = await join(link.projectId, userId, link.role);
			return { projectId: link.projectId, role };
		}
	};
}
