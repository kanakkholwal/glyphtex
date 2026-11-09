import { and, eq } from "drizzle-orm";
import type { Db, Tx } from "../db/client.ts";
import { account, ssoProvider, user } from "../db/schema.ts";

/**
 * Two-factor is met by an enrolled authenticator, or by signing in through the org's own SSO
 * (its identity provider does the second factor).
 */
export async function twoFactorSatisfied(db: Db | Tx, orgId: string, userId: string) {
	const [u] = await db
		.select({ enabled: user.twoFactorEnabled })
		.from(user)
		.where(eq(user.id, userId))
		.limit(1);
	if (u?.enabled) return true;
	const viaSso = await db
		.select({ id: account.id })
		.from(account)
		.innerJoin(
			ssoProvider,
			and(eq(ssoProvider.providerId, account.providerId), eq(ssoProvider.organizationId, orgId))
		)
		.where(eq(account.userId, userId))
		.limit(1);
	return viaSso.length > 0;
}
