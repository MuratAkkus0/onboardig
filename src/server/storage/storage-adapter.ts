import "server-only";

export interface StoredObject {
  stream: ReadableStream<Uint8Array>;
  sizeBytes: number;
}

/**
 * Where uploaded files live. v1 ships `LocalDiskStorage`; an object store can replace it later
 * without touching the services (keys are opaque `<yyyy>/<mm>/<uuid>.<ext>` strings).
 */
export interface StorageAdapter {
  put(key: string, bytes: Uint8Array): Promise<void>;
  /** @returns null when the key does not exist */
  get(key: string): Promise<StoredObject | null>;
  /** Deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
}
