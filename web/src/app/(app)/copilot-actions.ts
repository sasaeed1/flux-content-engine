'use server';

import { api } from '@/lib/api-client';

/** Generate hooks for the Copilot's hook factory. */
export async function copilotHooksAction(topic: string, count = 5) {
  return await api.intelligence.hooks({ topic, count });
}

/** Load fresh insights for the Copilot to surface contextually. */
export async function copilotInsightsAction(surface = 'dashboard') {
  try {
    const { insights } = await api.intelligence.insights(surface);
    return insights;
  } catch {
    return [];
  }
}

/** Natural-language ask routed through the command interpreter. */
export async function copilotAskAction(input: string) {
  return await api.intelligence.command(input);
}
