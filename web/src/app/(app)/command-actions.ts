'use server';

/**
 * Server actions for the Cmd-K palette.
 * The palette is a client component — these wrappers let it talk to the
 * engine through the server-side api-client (which holds the org API key).
 */
import { revalidatePath } from 'next/cache';
import { api } from '@/lib/api-client';

export async function runCommandAction(input: string) {
  return await api.intelligence.command(input);
}

/** Sprint C — recent Cmd-K commands for the recall list. */
export async function commandHistoryAction() {
  try {
    return await api.intelligence.commandHistory();
  } catch {
    return { history: [] };
  }
}

export async function generateTopicsViaCmdAction(count: number, theme?: string) {
  const res = await api.generateTopics(count, theme);
  revalidatePath('/home');
  revalidatePath('/library');
  return res;
}

export async function runPipelineViaCmdAction() {
  const res = await api.runPipeline({ approvalMode: 'manual' });
  revalidatePath('/home');
  revalidatePath('/library');
  return res;
}
