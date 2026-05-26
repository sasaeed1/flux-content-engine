/**
 * Resolve an Instagram account for a tenant.
 * Credentials live per organization on the `instagram_accounts` table —
 * there is intentionally NO env-level fallback (this is multi-tenant SaaS).
 */
import {
  getDefaultInstagramAccount,
  getInstagramAccountById,
} from '../../db/repositories';
import { NotFoundError } from '../../lib/errors';
import type { InstagramAccountRow, ResolvedInstagramAccount } from '../../types';

function fromRow(row: InstagramAccountRow): ResolvedInstagramAccount {
  return {
    id: row.id,
    organizationId: row.organization_id,
    igBusinessAccountId: row.ig_business_account_id,
    igAccessToken: row.ig_access_token,
    username: row.username,
  };
}

export async function resolveInstagramAccount(
  orgId: string,
  accountId?: string | null,
): Promise<ResolvedInstagramAccount> {
  const row = accountId
    ? await getInstagramAccountById(orgId, accountId)
    : await getDefaultInstagramAccount(orgId);

  if (!row) {
    throw new NotFoundError(
      `Organization ${orgId} has no Instagram account configured. Connect one first.`,
    );
  }
  return fromRow(row);
}
