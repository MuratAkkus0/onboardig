import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalDiskStorage } from "@/server/storage/local-disk-storage";

let root: string;
let outside: string;
let storage: LocalDiskStorage;

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

beforeEach(async () => {
  const base = await mkdtemp(path.join(tmpdir(), "storage-test-"));
  root = path.join(base, "root");
  outside = path.join(base, "outside.txt");
  await writeFile(outside, "secret");
  storage = new LocalDiskStorage(root);
});

afterEach(async () => {
  await rm(path.dirname(root), { recursive: true, force: true });
});

describe("LocalDiskStorage", () => {
  it("stores, reads and deletes a file", async () => {
    await storage.put("2026/11/a.png", new Uint8Array([1, 2, 3]));
    expect(await readFile(path.join(root, "2026/11/a.png"))).toEqual(Buffer.from([1, 2, 3]));
    const stored = await storage.get("2026/11/a.png");
    expect(stored?.sizeBytes).toBe(3);
    expect(await readAll(stored!.stream)).toEqual(new Uint8Array([1, 2, 3]));
    await storage.delete("2026/11/a.png");
    await expect(stat(path.join(root, "2026/11/a.png"))).rejects.toThrow();
    expect(await storage.get("2026/11/a.png")).toBeNull();
  });

  it("returns null for a missing key and tolerates deleting one", async () => {
    expect(await storage.get("2026/11/missing.png")).toBeNull();
    await expect(storage.delete("2026/11/missing.png")).resolves.toBeUndefined();
  });

  it("never overwrites an existing file", async () => {
    await storage.put("a.bin", new Uint8Array([1]));
    await expect(storage.put("a.bin", new Uint8Array([2]))).rejects.toThrow();
  });

  it.each([
    "../outside.txt",
    "a/../../outside.txt",
    "/etc/passwd",
    "..",
    ".",
    "a/./b",
    "a//b",
    "a\\..\\b",
    "a/b/",
    "",
    "a\0b",
    "%2e%2e/outside.txt",
  ])("rejects the key %j", async (key) => {
    await expect(storage.put(key, new Uint8Array([1]))).rejects.toThrow("invalid storage key");
    await expect(storage.get(key)).rejects.toThrow("invalid storage key");
    await expect(storage.delete(key)).rejects.toThrow("invalid storage key");
    expect(await readFile(outside, "utf8")).toBe("secret");
  });
});
