import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "@/server/logger";

function capture() {
  const lines: string[] = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { lines, logger: createLogger({ level: "info", destination }) };
}

describe("logger redaction", () => {
  it("redacts credentials, tokens, links and cookies", () => {
    const { lines, logger } = capture();
    logger.info(
      {
        password: "hunter2-hunter2",
        token: "tok-123",
        url: "https://app.example/set-password?token=tok-123",
        data: { newPassword: "np-456", link: "https://x.example/l", cookie: "session=abc" },
        headers: { cookie: "session=abc", authorization: "Bearer xyz" },
        entityId: "visible-id",
      },
      "check",
    );
    const output = lines.join("");
    for (const secret of ["hunter2", "tok-123", "np-456", "x.example", "session=abc", "Bearer"]) {
      expect(output).not.toContain(secret);
    }
    expect(output).toContain("visible-id");
    expect(output).toContain("[redacted]");
  });
});
