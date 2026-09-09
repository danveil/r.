import type { Config } from '@netlify/functions';
import { cleanupShares } from '../../server/partner-api';
import { blobStore } from '../../server/blob-store';
export default async () => {
  await cleanupShares(blobStore());
  return new Response(null, { status: 204 });
};
export const config: Config = { schedule: '@daily' };
