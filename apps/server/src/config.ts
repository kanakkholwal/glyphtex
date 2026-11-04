import { z } from "zod";

const list = z
	.string()
	.default("")
	.transform((s) =>
		s
			.split(",")
			.map((v) => v.trim())
			.filter(Boolean)
	);
const int = (fallback: number) => z.coerce.number().int().positive().default(fallback);
const optional = z
	.string()
	.optional()
	.transform((v) => (v ? v : undefined));

const schema = z.object({
	PUBLIC_URL: z.url(),
	APP_URL: z.url(),
	WEB_ORIGINS: list,
	BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
	COOKIE_DOMAIN: optional,
	CLIENT_IP_HEADER: z.string().default("x-forwarded-for"),

	DATABASE_URL: optional,
	REDIS_URL: optional,
	RABBITMQ_URL: optional,

	QUEUE_DRIVER: z.enum(["cloudflare", "rabbitmq", "redis"]).optional(),
	BLOB_DRIVER: z.enum(["r2", "s3"]).optional(),
	MAIL_DRIVER: z.enum(["resend", "smtp"]).default("resend"),

	S3_ENDPOINT: optional,
	S3_REGION: z.string().default("auto"),
	S3_BUCKET: optional,
	S3_ACCESS_KEY_ID: optional,
	S3_SECRET_ACCESS_KEY: optional,

	MAIL_FROM: z.string().default("GlyphTeX <no-reply@glyphtex.com>"),
	RESEND_API_KEY: optional,
	SMTP_URL: optional,

	GOOGLE_CLIENT_ID: optional,
	GOOGLE_CLIENT_SECRET: optional,
	GITHUB_CLIENT_ID: optional,
	GITHUB_CLIENT_SECRET: optional,
	GITLAB_CLIENT_ID: optional,
	GITLAB_CLIENT_SECRET: optional,
	GITLAB_ISSUER: optional,

	MAX_TEXT_FILE_BYTES: int(2 * 1024 * 1024),
	MAX_BINARY_FILE_BYTES: int(50 * 1024 * 1024),
	MAX_FILES_PER_PROJECT: int(2000),
	MAX_IMPORT_BYTES: int(100 * 1024 * 1024),
	API_RATE_LIMIT: int(300),
	API_RATE_WINDOW_SECONDS: int(60),
	INVITE_TTL_HOURS: int(24 * 7),
	AUDIT_RETENTION_DAYS: int(365)
});

export type Config = ReturnType<typeof parseConfig>;

/** Parses untrusted env into typed config; throws one readable error listing every problem. */
export function parseConfig(env: Record<string, unknown>) {
	const parsed = schema.safeParse(env);
	if (!parsed.success) {
		const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
		throw new Error(`Invalid server configuration:\n  ${issues.join("\n  ")}`);
	}
	const e = parsed.data;
	return {
		publicUrl: e.PUBLIC_URL.replace(/\/$/, ""),
		appUrl: e.APP_URL.replace(/\/$/, ""),
		webOrigins: [...new Set([new URL(e.APP_URL).origin, ...e.WEB_ORIGINS])],
		authSecret: e.BETTER_AUTH_SECRET,
		cookieDomain: e.COOKIE_DOMAIN,
		clientIpHeader: e.CLIENT_IP_HEADER.toLowerCase(),
		databaseUrl: e.DATABASE_URL,
		redisUrl: e.REDIS_URL,
		rabbitmqUrl: e.RABBITMQ_URL,
		queueDriver: e.QUEUE_DRIVER,
		blobDriver: e.BLOB_DRIVER,
		mailDriver: e.MAIL_DRIVER,
		s3: {
			endpoint: e.S3_ENDPOINT,
			region: e.S3_REGION,
			bucket: e.S3_BUCKET,
			accessKeyId: e.S3_ACCESS_KEY_ID,
			secretAccessKey: e.S3_SECRET_ACCESS_KEY
		},
		mail: { from: e.MAIL_FROM, resendApiKey: e.RESEND_API_KEY, smtpUrl: e.SMTP_URL },
		oauth: {
			google: pair(e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET),
			github: pair(e.GITHUB_CLIENT_ID, e.GITHUB_CLIENT_SECRET),
			gitlab: pair(e.GITLAB_CLIENT_ID, e.GITLAB_CLIENT_SECRET),
			gitlabIssuer: e.GITLAB_ISSUER
		},
		limits: {
			textFileBytes: e.MAX_TEXT_FILE_BYTES,
			binaryFileBytes: e.MAX_BINARY_FILE_BYTES,
			filesPerProject: e.MAX_FILES_PER_PROJECT,
			importBytes: e.MAX_IMPORT_BYTES,
			apiRequests: e.API_RATE_LIMIT,
			apiWindowSeconds: e.API_RATE_WINDOW_SECONDS,
			inviteTtlHours: e.INVITE_TTL_HOURS,
			auditRetentionDays: e.AUDIT_RETENTION_DAYS
		}
	};
}

function pair(clientId?: string, clientSecret?: string) {
	return clientId && clientSecret ? { clientId, clientSecret } : undefined;
}

/** Narrows an optional config value, failing with the env var the operator must set. */
export function required<T>(value: T | undefined, name: string): T {
	if (value === undefined) throw new Error(`Missing required configuration: ${name}`);
	return value;
}
