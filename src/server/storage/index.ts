import "server-only";
import { env } from "@/config/env";
import { LocalDiskStorage } from "./local-disk-storage";
import type { StorageAdapter } from "./storage-adapter";

/** The configured storage backend (local disk under `UPLOAD_DIR`; read at call time). */
export function getStorage(): StorageAdapter {
  return new LocalDiskStorage(env.UPLOAD_DIR);
}

export type { StorageAdapter, StoredObject } from "./storage-adapter";
