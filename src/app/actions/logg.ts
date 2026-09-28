'use server';

import { redirect } from 'next/navigation';

import { requireLoggatkomst, stangLogg } from '@/lib/auth/logg';

/** Stänger aktivitetsloggen i den här webbläsaren. */
export async function stangLoggAction(): Promise<void> {
  await requireLoggatkomst();
  await stangLogg();
  redirect('/');
}
