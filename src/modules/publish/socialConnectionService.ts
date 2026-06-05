/**
 * Social connections — connect / list / disconnect social accounts and publish
 * content to any combination of them. Credentials live per-org in the
 * `social_connections` table; publishing routes through the platform registry.
 */
import { supabase } from '../../lib/supabase';
import { NotFoundError, ValidationError } from '../../lib/errors';
import { childLogger } from '../../lib/logger';
import { getPublisher, isPlatform, listDescriptors } from './platforms/registry';
import type {
  ConnectFields,
  PublishOutcome,
  PublishPayload,
  SocialConnection,
  SocialPlatform,
} from './platforms/types';

const log = childLogger({ module: 'social' });

interface Row {
  id: string;
  organization_id: string;
  platform: string;
  display_name: string | null;
  external_id: string | null;
  access_token: string | null;
  status: string;
  is_default: boolean;
  metadata: Record<string, unknown> | null;
}

function toConn(r: Row): SocialConnection {
  return {
    id: r.id,
    organizationId: r.organization_id,
    platform: r.platform as SocialPlatform,
    displayName: r.display_name,
    externalId: r.external_id,
    accessToken: r.access_token,
    status: (r.status as SocialConnection['status']) ?? 'connected',
    isDefault: r.is_default,
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  };
}

/** A connection without its secret — safe to return to the browser. */
export function publicConnection(c: SocialConnection) {
  return {
    id: c.id,
    platform: c.platform,
    displayName: c.displayName,
    externalId: c.externalId,
    status: c.status,
    isDefault: c.isDefault,
  };
}

export function platformCatalog() {
  return listDescriptors();
}

export async function listConnections(orgId: string): Promise<SocialConnection[]> {
  const { data, error } = await supabase
    .from('social_connections')
    .select('*')
    .eq('organization_id', orgId)
    .neq('status', 'disconnected')
    .order('created_at', { ascending: true });
  if (error) throw new ValidationError(error.message);
  return (data ?? []).map((r) => toConn(r as Row));
}

export async function connectAccount(
  orgId: string,
  platform: string,
  fields: ConnectFields,
): Promise<SocialConnection> {
  if (!isPlatform(platform)) throw new ValidationError(`Unknown platform: ${platform}`);
  const pub = getPublisher(platform);
  const v = await pub.validate(fields);
  if (!v.ok) throw new ValidationError(v.error ?? 'Could not validate those credentials.');

  const existing = await listConnections(orgId);
  const isFirstForPlatform = !existing.some((c) => c.platform === platform);

  const { data, error } = await supabase
    .from('social_connections')
    .insert({
      organization_id: orgId,
      platform,
      display_name: v.displayName ?? null,
      external_id: v.externalId ?? null,
      access_token: v.accessToken ?? null,
      status: 'connected',
      is_default: isFirstForPlatform,
      metadata: v.metadata ?? {},
    })
    .select('*')
    .single();
  if (error) throw new ValidationError(error.message);
  log.info({ orgId, platform }, 'Social account connected');
  return toConn(data as Row);
}

export async function disconnectAccount(orgId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from('social_connections')
    .update({ status: 'disconnected', is_default: false })
    .eq('organization_id', orgId)
    .eq('id', id);
  if (error) throw new ValidationError(error.message);
  log.info({ orgId, id }, 'Social account disconnected');
}

export async function getConnection(orgId: string, id: string): Promise<SocialConnection> {
  const { data, error } = await supabase
    .from('social_connections')
    .select('*')
    .eq('organization_id', orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new ValidationError(error.message);
  if (!data) throw new NotFoundError(`Connection ${id} not found`);
  return toConn(data as Row);
}

/** Publish one payload to each selected connection; never throws per-target. */
export async function publishToConnections(
  orgId: string,
  connectionIds: string[],
  payload: PublishPayload,
): Promise<PublishOutcome[]> {
  const all = await listConnections(orgId);
  const targets = all.filter((c) => connectionIds.includes(c.id) && c.status === 'connected');
  if (targets.length === 0) throw new ValidationError('No connected channels selected.');

  const out: PublishOutcome[] = [];
  for (const c of targets) {
    try {
      out.push(await getPublisher(c.platform).publish(c, payload));
    } catch (e) {
      out.push({
        platform: c.platform,
        connectionId: c.id,
        ok: false,
        error: e instanceof Error ? e.message : 'publish failed',
      });
    }
  }
  log.info(
    { orgId, targets: targets.length, ok: out.filter((o) => o.ok).length },
    'Published to channels',
  );
  return out;
}
