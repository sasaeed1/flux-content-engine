/**
 * Run the carousel pipeline once locally for the demo organization.
 *
 *   npm run test:pipeline                  # uses the demo org from seed.sql
 *   npm run test:pipeline <org-uuid>       # any other org
 */
import { runPipeline } from '../src/pipeline/pipeline';
import { ensureBuckets } from '../src/lib/storage';
import { shutdownRenderer } from '../src/modules/render/htmlRenderer';
import {
  getNextPendingTopic,
  getOrgById,
  insertTopics,
} from '../src/db/repositories';
import { logger } from '../src/lib/logger';
import { toErrorMessage } from '../src/lib/errors';

const DEMO_ORG_ID = '11111111-1111-1111-1111-111111111111';

async function ensureDemoTopic(orgId: string): Promise<void> {
  const existing = await getNextPendingTopic(orgId);
  if (existing) return;
  await insertTopics([
    {
      organization_id: orgId,
      topic: '3 AI Automations Small Businesses Need Right Now',
      angle: 'Practical, do-it-this-week tactics for non-technical founders',
      post_type: 'carousel',
      scheduled_date: new Date().toISOString().slice(0, 10),
      priority: 10,
      source: 'manual',
    },
  ]);
  logger.info('Demo topic inserted for testing');
}

async function main(): Promise<void> {
  const orgId = process.argv[2] || DEMO_ORG_ID;
  const org = await getOrgById(orgId);
  if (!org) {
    logger.error({ orgId }, 'Organization not found — run db/seed.sql first');
    process.exit(2);
  }
  logger.info({ orgId, name: org.name }, 'Starting test pipeline');

  await ensureBuckets();
  await ensureDemoTopic(orgId);

  // Manual mode: pipeline stops at "ready for review" instead of trying to
  // enqueue for publishing. Lets us demo without a connected Instagram account.
  const result = await runPipeline({ organizationId: orgId, approvalMode: 'manual' });
  logger.info({ result }, 'Pipeline finished');

  await shutdownRenderer();

  if (result.status !== 'completed' && result.status !== 'pending_approval') {
    process.exitCode = 1;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((err) => {
    logger.error({ error: toErrorMessage(err) }, 'Test run crashed');
    process.exit(1);
  });
