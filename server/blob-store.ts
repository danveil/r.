import { getStore } from '@netlify/blobs';
import type { ShareRecord, ShareStore } from './partner-api';
export function blobStore(): ShareStore {
  const store = getStore({
    name: 'rayang-partner-v1',
    consistency: 'strong',
    fetch: async (input, init) => {
      const response = await fetch(input, init);
      // Fail closed, including SDK versions that otherwise misreport failed conditional writes.
      if (!response.ok && ![404, 412, 304].includes(response.status)) throw new Error('Storage unavailable');
      return response;
    },
  });
  return {
    async get(id) {
      const result = await store.getWithMetadata(id, { type: 'json', consistency: 'strong' });
      if (!result) return null;
      if (!result.etag) throw new Error('Missing version');
      return { value: result.data as ShareRecord, etag: result.etag };
    },
    async put(id, value, etag) {
      const result = await store.setJSON(id, value, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      return result.modified;
    },
    async delete(id) {
      await store.delete(id);
    },
    async *list() {
      for await (const page of store.list({ paginate: true })) for (const blob of page.blobs) yield blob.key;
    },
  };
}
