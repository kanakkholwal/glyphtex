import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	integer,
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
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index("project_owner_idx").on(t.ownerId)]
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

export const schema = {
	user,
	session,
	account,
	verification,
	rateLimit,
	project,
	projectFile,
	projectMember,
	projectInvite,
	shareLink
};
