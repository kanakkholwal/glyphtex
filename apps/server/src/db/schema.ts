import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

// --- Better Auth core tables (field names are its contract) ---

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull().default(false),
	image: text("image"),
	twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

export const session = pgTable(
	"session",
	{
		id: text("id").primaryKey(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		token: text("token").notNull().unique(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		activeOrganizationId: text("active_organization_id"),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index("session_user_idx").on(t.userId)]
);

export const account = pgTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
		refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
		scope: text("scope"),
		password: text("password"),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index("account_user_idx").on(t.userId)]
);

export const verification = pgTable(
	"verification",
	{
		id: text("id").primaryKey(),
		identifier: text("identifier").notNull(),
		value: text("value").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index("verification_identifier_idx").on(t.identifier)]
);

export const rateLimit = pgTable("rate_limit", {
	id: text("id").primaryKey(),
	key: text("key").notNull().unique(),
	count: integer("count").notNull(),
	lastRequest: bigint("last_request", { mode: "number" }).notNull()
});

// --- Better Auth organization plugin (field names are its contract) ---

export const ORG_ROLES = ["owner", "admin", "member"] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const organization = pgTable("organization", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	slug: text("slug").notNull().unique(),
	logo: text("logo"),
	metadata: text("metadata"),
	createdAt: createdAt()
});

export const member = pgTable(
	"member",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role").notNull().default("member"),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex("member_org_user_idx").on(t.organizationId, t.userId),
		index("member_user_org_idx").on(t.userId)
	]
);

export const invitation = pgTable(
	"invitation",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role"),
		status: text("status").notNull().default("pending"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: createdAt(),
		inviterId: text("inviter_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" })
	},
	(t) => [
		index("invitation_org_idx").on(t.organizationId),
		index("invitation_email_idx").on(t.email)
	]
);

// --- Organization policy, entitlements and audit ---

export const MEMBER_ACCESS = ["editor", "commenter", "viewer", "none"] as const;
export type MemberAccess = (typeof MEMBER_ACCESS)[number];
export const FEATURES = ["ai", "shareLinks", "externalInvites"] as const;
export type Feature = (typeof FEATURES)[number];

/** One row per org; absent means defaults (see DEFAULT_POLICY in rbac/org.ts). */
export const orgPolicy = pgTable("org_policy", {
	organizationId: text("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	memberAccess: text("member_access", { enum: MEMBER_ACCESS }).notNull().default("editor"),
	shareLinks: boolean("share_links").notNull().default(true),
	externalInvites: boolean("external_invites").notNull().default(true),
	ai: boolean("ai").notNull().default(false),
	requireTwoFactor: boolean("require_two_factor").notNull().default(false),
	seatLimit: integer("seat_limit"),
	updatedAt: updatedAt()
});

/** Per-member override of an org policy feature; absent means the org default applies. */
export const memberFeature = pgTable(
	"member_feature",
	{
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		feature: text("feature", { enum: FEATURES }).notNull(),
		enabled: boolean("enabled").notNull()
	},
	(t) => [primaryKey({ columns: [t.organizationId, t.userId, t.feature] })]
);

export const auditEvent = pgTable(
	"audit_event",
	{
		id: text("id").primaryKey(),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
		action: text("action").notNull(),
		targetType: text("target_type").notNull(),
		targetId: text("target_id"),
		meta: jsonb("meta").$type<Record<string, string | number | boolean | null>>(),
		createdAt: createdAt()
	},
	(t) => [index("audit_org_time_idx").on(t.organizationId, t.createdAt)]
);

// --- GlyphTeX ---

export const PROJECT_ROLES = ["owner", "editor", "commenter", "viewer"] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];
export const GRANTABLE_ROLES = ["editor", "commenter", "viewer"] as const;
export type GrantableRole = (typeof GRANTABLE_ROLES)[number];

export const project = pgTable(
	"project",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		mainFile: text("main_file").notNull().default("main.tex"),
		ownerId: text("owner_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		organizationId: text("organization_id").references(() => organization.id, {
			onDelete: "cascade"
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index("project_owner_idx").on(t.ownerId), index("project_org_idx").on(t.organizationId)]
);

export const projectFile = pgTable(
	"project_file",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		path: text("path").notNull(),
		kind: text("kind", { enum: ["text", "binary"] }).notNull(),
		content: text("content"),
		blobKey: text("blob_key"),
		contentType: text("content_type"),
		size: integer("size").notNull(),
		sha256: text("sha256").notNull(),
		version: integer("version").notNull().default(1),
		updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
		updatedAt: updatedAt()
	},
	(t) => [
		primaryKey({ columns: [t.projectId, t.path] }),
		index("project_file_blob_idx").on(t.blobKey),
		check(
			"project_file_storage",
			sql`(${t.kind} = 'text' and ${t.content} is not null and ${t.blobKey} is null) or (${t.kind} = 'binary' and ${t.blobKey} is not null and ${t.content} is null)`
		)
	]
);

export const projectMember = pgTable(
	"project_member",
	{
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		role: text("role", { enum: GRANTABLE_ROLES }).notNull(),
		createdAt: createdAt()
	},
	(t) => [primaryKey({ columns: [t.projectId, t.userId] }), index("member_user_idx").on(t.userId)]
);

export const projectInvite = pgTable(
	"project_invite",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		email: text("email").notNull(),
		role: text("role", { enum: GRANTABLE_ROLES }).notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		invitedBy: text("invited_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex("invite_project_email_idx").on(t.projectId, t.email)]
);

export const shareLink = pgTable(
	"share_link",
	{
		id: text("id").primaryKey(),
		projectId: text("project_id")
			.notNull()
			.references(() => project.id, { onDelete: "cascade" }),
		role: text("role", { enum: GRANTABLE_ROLES }).notNull(),
		tokenHash: text("token_hash").notNull().unique(),
		createdBy: text("created_by")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		createdAt: createdAt()
	},
	(t) => [index("share_link_project_idx").on(t.projectId)]
);

/** Org projects members can start from; the project itself stays the template's source. */
export const orgTemplate = pgTable(
	"org_template",
	{
		projectId: text("project_id")
			.primaryKey()
			.references(() => project.id, { onDelete: "cascade" }),
		organizationId: text("organization_id")
			.notNull()
			.references(() => organization.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
		createdAt: createdAt()
	},
	(t) => [index("org_template_org_idx").on(t.organizationId)]
);

/** The org's shared packages and fonts live in one ordinary project, added to every org compile. */
export const orgLibrary = pgTable("org_library", {
	organizationId: text("organization_id")
		.primaryKey()
		.references(() => organization.id, { onDelete: "cascade" }),
	projectId: text("project_id")
		.notNull()
		.unique()
		.references(() => project.id, { onDelete: "cascade" })
});

// --- Plugin tables: two-factor, SSO and SCIM (field names are the plugins' contract) ---

export const twoFactor = pgTable(
	"two_factor",
	{
		id: text("id").primaryKey(),
		secret: text("secret").notNull(),
		backupCodes: text("backup_codes").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		verified: boolean("verified"),
		failedVerificationCount: integer("failed_verification_count"),
		lockedUntil: timestamp("locked_until", { withTimezone: true })
	},
	(t) => [index("two_factor_secret_idx").on(t.secret), index("two_factor_user_id_idx").on(t.userId)]
);

export const ssoProvider = pgTable("sso_provider", {
	id: text("id").primaryKey(),
	issuer: text("issuer").notNull(),
	oidcConfig: text("oidc_config"),
	samlConfig: text("saml_config"),
	userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
	providerId: text("provider_id").notNull().unique(),
	organizationId: text("organization_id").references(() => organization.id, {
		onDelete: "cascade"
	}),
	domain: text("domain").notNull(),
	domainVerified: boolean("domain_verified")
});

export const scimManagedConnection = pgTable(
	"scim_managed_connection",
	{
		id: text("id").primaryKey(),
		creationRequestId: text("creation_request_id").notNull().unique(),
		connectionId: text("connection_id").notNull().unique(),
		provisioningDomainId: text("provisioning_domain_id").notNull(),
		status: text("status").notNull(),
		revision: integer("revision").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		createdBy: text("created_by").notNull(),
		decommissionStartedAt: timestamp("decommission_started_at", { withTimezone: true }),
		decommissionStartedBy: text("decommission_started_by"),
		decommissionedAt: timestamp("decommissioned_at", { withTimezone: true }),
		decommissionedBy: text("decommissioned_by")
	},
	(t) => [index("scim_managed_connection_provisioning_domain_id_idx").on(t.provisioningDomainId)]
);

export const scimManagedCredential = pgTable(
	"scim_managed_credential",
	{
		id: text("id").primaryKey(),
		connectionRecordId: text("connection_record_id")
			.notNull()
			.references(() => scimManagedConnection.id, { onDelete: "cascade" }),
		credentialId: text("credential_id").notNull().unique(),
		tokenDigest: text("token_digest").notNull(),
		hashVersion: text("hash_version").notNull(),
		activeSlotKey: text("active_slot_key").notNull().unique(),
		status: text("status").notNull(),
		serializedScopes: text("serialized_scopes").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		createdBy: text("created_by").notNull(),
		lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		revokedBy: text("revoked_by"),
		decommissionedAt: timestamp("decommissioned_at", { withTimezone: true })
	},
	(t) => [index("scim_managed_credential_connection_record_id_idx").on(t.connectionRecordId)]
);

export const scimManagedConnectionEvent = pgTable(
	"scim_managed_connection_event",
	{
		id: text("id").primaryKey(),
		connectionRecordId: text("connection_record_id")
			.notNull()
			.references(() => scimManagedConnection.id, { onDelete: "cascade" }),
		eventKey: text("event_key").notNull().unique(),
		sequence: integer("sequence").notNull(),
		type: text("type").notNull(),
		actorId: text("actor_id").notNull(),
		credentialId: text("credential_id"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull()
	},
	(t) => [index("scim_managed_connection_event_connection_record_id_idx").on(t.connectionRecordId)]
);

export const scimConnectionBinding = pgTable(
	"scim_connection_binding",
	{
		id: text("id").primaryKey(),
		connectionId: text("connection_id").notNull(),
		connectionKey: text("connection_key").notNull().unique(),
		provisioningDomainId: text("provisioning_domain_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		decommissionedAt: timestamp("decommissioned_at", { withTimezone: true }),
		decommissionStatus: text("decommission_status").notNull(),
		decommissionCursorUserId: text("decommission_cursor_user_id"),
		decommissionReconciledUserCount: integer("decommission_reconciled_user_count").notNull(),
		decommissionBatchCount: integer("decommission_batch_count").notNull(),
		decommissionRevision: integer("decommission_revision").notNull(),
		decommissionCompletedAt: timestamp("decommission_completed_at", { withTimezone: true }),
		decommissionLeaseId: text("decommission_lease_id"),
		decommissionLeaseExpiresAt: timestamp("decommission_lease_expires_at", { withTimezone: true })
	},
	(t) => [index("scim_connection_binding_connection_id_idx").on(t.connectionId)]
);

export const scimIdentityTombstone = pgTable(
	"scim_identity_tombstone",
	{
		id: text("id").primaryKey(),
		connectionId: text("connection_id").notNull(),
		provisioningDomainId: text("provisioning_domain_id").notNull(),
		externalId: text("external_id").notNull(),
		externalIdKey: text("external_id_key").notNull().unique(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		profile: text("profile").notNull(),
		deletedAt: timestamp("deleted_at", { withTimezone: true }).notNull()
	},
	(t) => [
		index("scim_identity_tombstone_connection_id_idx").on(t.connectionId),
		index("scim_identity_tombstone_provisioning_domain_id_idx").on(t.provisioningDomainId),
		index("scim_identity_tombstone_user_id_idx").on(t.userId)
	]
);

export const scimSubject = pgTable(
	"scim_subject",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.unique()
			.references(() => user.id, { onDelete: "cascade" }),
		profileSourceId: text("profile_source_id"),
		revision: integer("revision").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
	},
	(t) => [index("scim_subject_profile_source_id_idx").on(t.profileSourceId)]
);

export const scimUser = pgTable(
	"scim_user",
	{
		id: text("id").primaryKey(),
		connectionId: text("connection_id").notNull(),
		provisioningDomainId: text("provisioning_domain_id").notNull(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		connectionUserKey: text("connection_user_key").notNull().unique(),
		userName: text("user_name").notNull(),
		userNameKey: text("user_name_key").notNull().unique(),
		primaryEmail: text("primary_email").notNull(),
		workEmailValueIndex: text("work_email_value_index").notNull(),
		emailValueIndex: text("email_value_index").notNull(),
		displayName: text("display_name").notNull(),
		formattedName: text("formatted_name").notNull(),
		givenName: text("given_name"),
		familyName: text("family_name"),
		serializedEmails: text("serialized_emails").notNull(),
		serializedAttributes: text("serialized_attributes"),
		externalId: text("external_id"),
		externalIdKey: text("external_id_key").unique(),
		active: boolean("active").notNull(),
		orderKey: text("order_key").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
	},
	(t) => [
		index("scim_user_connection_id_idx").on(t.connectionId),
		index("scim_user_provisioning_domain_id_idx").on(t.provisioningDomainId),
		index("scim_user_user_id_idx").on(t.userId)
	]
);

export const scimProjectionGrant = pgTable(
	"scim_projection_grant",
	{
		id: text("id").primaryKey(),
		connectionId: text("connection_id").notNull(),
		provisioningDomainId: text("provisioning_domain_id").notNull(),
		scimUserId: text("scim_user_id")
			.notNull()
			.references(() => scimUser.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		sourceKind: text("source_kind").notNull(),
		sourceId: text("source_id").notNull(),
		sourceValue: text("source_value"),
		role: text("role").notNull(),
		grantKey: text("grant_key").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
	},
	(t) => [
		index("scim_projection_grant_connection_id_idx").on(t.connectionId),
		index("scim_projection_grant_provisioning_domain_id_idx").on(t.provisioningDomainId),
		index("scim_projection_grant_scim_user_id_idx").on(t.scimUserId),
		index("scim_projection_grant_user_id_idx").on(t.userId)
	]
);

export const scimGroup = pgTable(
	"scim_group",
	{
		id: text("id").primaryKey(),
		connectionId: text("connection_id").notNull(),
		provisioningDomainId: text("provisioning_domain_id").notNull(),
		revision: integer("revision").notNull(),
		displayName: text("display_name").notNull(),
		displayNameKey: text("display_name_key").notNull().unique(),
		externalId: text("external_id"),
		externalIdKey: text("external_id_key").unique(),
		orderKey: text("order_key").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull()
	},
	(t) => [
		index("scim_group_connection_id_idx").on(t.connectionId),
		index("scim_group_provisioning_domain_id_idx").on(t.provisioningDomainId)
	]
);

export const scimGroupMember = pgTable(
	"scim_group_member",
	{
		id: text("id").primaryKey(),
		connectionId: text("connection_id").notNull(),
		groupId: text("group_id")
			.notNull()
			.references(() => scimGroup.id, { onDelete: "cascade" }),
		scimUserId: text("scim_user_id")
			.notNull()
			.references(() => scimUser.id, { onDelete: "cascade" }),
		membershipKey: text("membership_key").notNull().unique(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull()
	},
	(t) => [
		index("scim_group_member_connection_id_idx").on(t.connectionId),
		index("scim_group_member_group_id_idx").on(t.groupId),
		index("scim_group_member_scim_user_id_idx").on(t.scimUserId)
	]
);

export const schema = {
	user,
	session,
	account,
	verification,
	rateLimit,
	organization,
	member,
	invitation,
	orgPolicy,
	memberFeature,
	auditEvent,
	project,
	projectFile,
	projectMember,
	projectInvite,
	shareLink,
	orgTemplate,
	orgLibrary,
	twoFactor,
	ssoProvider,
	scimManagedConnection,
	scimManagedCredential,
	scimManagedConnectionEvent,
	scimConnectionBinding,
	scimIdentityTombstone,
	scimSubject,
	scimUser,
	scimProjectionGrant,
	scimGroup,
	scimGroupMember
};
