import type { Config } from '@netlify/functions';
import { partnerApi } from '../../server/partner-api';
import { blobStore } from '../../server/blob-store';
export default async (request: Request) => {
  try {
    return await partnerApi(request, blobStore());
  } catch {
    return new Response('{"error":"Unavailable"}', {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'Netlify-CDN-Cache-Control': 'no-store',
      },
    });
  }
};
export const config: Config = {
  path: '/api/partner/:id',
  rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['domain', 'ip'], action: 'rate_limit' },
};
