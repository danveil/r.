import { SECRET } from './protocol';
export class PartnerError extends Error {
  constructor(public reason: 'unavailable' | 'network' | 'invalid' | 'conflict') {
    super(
      reason === 'unavailable'
        ? 'This partner connection is no longer available.'
        : reason === 'invalid'
          ? 'We couldn’t read the shared cycle. Try pairing again.'
          : reason === 'conflict'
            ? 'This invitation could not be created. Stop it and try a new invitation.'
            : 'Couldn’t connect. Your saved information is still here. Try again when you’re online.',
    );
  }
}
export async function requestShare(
  id: string,
  token: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: object,
): Promise<Record<string, unknown>> {
  if (!SECRET.test(id) || !SECRET.test(token)) throw new PartnerError('invalid');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const result = await fetch(`/api/partner/${id}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      redirect: 'error',
      signal: controller.signal,
    });
    if ([401, 403, 404, 410].includes(result.status) && result.headers.get('x-rayang-partner') === '1')
      throw new PartnerError('unavailable');
    if (result.status === 409) throw new PartnerError('conflict');
    if (!result.ok) throw new PartnerError('network');
    if (!result.headers.get('content-type')?.includes('application/json')) throw new PartnerError('invalid');
    const reader = result.body?.getReader();
    if (!reader) throw new PartnerError('invalid');
    const decoder = new TextDecoder();
    let raw = '';
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 48000) {
        await reader.cancel();
        throw new PartnerError('invalid');
      }
      raw += decoder.decode(part.value, { stream: true });
    }
    raw += decoder.decode();
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new PartnerError('invalid');
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof PartnerError) throw error;
    throw new PartnerError('network');
  } finally {
    clearTimeout(timeout);
  }
}
