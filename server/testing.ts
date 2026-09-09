import type { ShareRecord, ShareStore, StoredShare } from './partner-api';
/** Isolated, in-memory adapter for tests and the explicitly local development server only. */
export class MemoryShareStore implements ShareStore {
  records = new Map<string, StoredShare>();
  private revision = 0;
  async get(id: string) {
    return structuredClone(this.records.get(id) ?? null);
  }
  async put(id: string, value: ShareRecord, etag?: string) {
    const current = this.records.get(id);
    if (etag ? current?.etag !== etag : !!current) return false;
    this.records.set(id, { value: structuredClone(value), etag: String(++this.revision) });
    return true;
  }
  async delete(id: string) {
    this.records.delete(id);
  }
  async *list() {
    for (const id of this.records.keys()) yield id;
  }
}
