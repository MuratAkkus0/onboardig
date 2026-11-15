import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageAdapter, StoredObject } from "./storage-adapter";

// Letters, digits and . _ - separated by "/": no absolute paths, no backslashes, no NUL bytes.
const SAFE_KEY = /^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;

/** Stores files below one root directory; every key is checked to stay inside it. */
export class LocalDiskStorage implements StorageAdapter {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  /** @throws Error for keys that are malformed or would leave the root (path traversal). */
  private resolveKey(key: string): string {
    const segments = key.split("/");
    if (!SAFE_KEY.test(key) || segments.some((segment) => segment === "." || segment === "..")) {
      throw new Error("invalid storage key");
    }
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error("invalid storage key");
    return target;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const target = this.resolveKey(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes, { flag: "wx" });
  }

  async get(key: string): Promise<StoredObject | null> {
    const target = this.resolveKey(key);
    try {
      const info = await stat(target);
      if (!info.isFile()) return null;
      const stream = Readable.toWeb(createReadStream(target)) as ReadableStream<Uint8Array>;
      return { stream, sizeBytes: info.size };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolveKey(key), { force: true });
  }
}
