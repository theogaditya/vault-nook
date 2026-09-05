/**
 * R2 Object Storage Operations Service
 */

export class R2Service {
  constructor(private bucket: R2Bucket) {}

  /**
   * Put encrypted chunk payload into R2 object key
   * Key pattern: objects/<object_id>/chunk_<index_padded>
   */
  async putChunk(
    objectId: string,
    chunkIndex: number,
    payload: ReadableStream | ArrayBuffer | Uint8Array
  ): Promise<R2Object> {
    const chunkName = chunkIndex.toString().padStart(6, '0');
    const key = `objects/${objectId}/chunk_${chunkName}`;
    return this.bucket.put(key, payload, {
      httpMetadata: {
        contentType: 'application/octet-stream',
      },
    });
  }

  /**
   * Get encrypted chunk payload from R2
   */
  async getChunk(objectId: string, chunkIndex: number): Promise<R2ObjectBody | null> {
    const chunkName = chunkIndex.toString().padStart(6, '0');
    const key = `objects/${objectId}/chunk_${chunkName}`;
    return this.bucket.get(key);
  }

  /**
   * Delete object files from R2
   */
  async deleteObjectChunks(objectId: string): Promise<void> {
    const prefix = `objects/${objectId}/`;
    let cursor: string | undefined;
    do {
      const list = await this.bucket.list({ prefix, cursor });
      const keys = list.objects.map((o) => o.key);
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => this.bucket.delete(key)));
      }
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
  }

  async getObjectChunkStats(objectId: string): Promise<{ count: number; totalBytes: number }> {
    const prefix = `objects/${objectId}/`;
    let count = 0;
    let totalBytes = 0;
    let cursor: string | undefined;
    do {
      const list = await this.bucket.list({ prefix, cursor });
      count += list.objects.length;
      totalBytes += list.objects.reduce((sum, item) => sum + item.size, 0);
      cursor = list.truncated ? list.cursor : undefined;
    } while (cursor);
    return { count, totalBytes };
  }
}
