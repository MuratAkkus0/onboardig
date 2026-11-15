import { describe, expect, it } from "vitest";
import { PAGE_STATUSES } from "@/config/app";
import {
  allowedPageActions,
  isVisibleToEmployees,
  nextPageStatus,
  PAGE_TRANSITIONS,
} from "@/lib/domain/page-status";
import { AppError } from "@/server/errors";

describe("page status machine", () => {
  it("follows the documented transitions", () => {
    expect(nextPageStatus("draft", "publish")).toBe("published");
    expect(nextPageStatus("draft", "archive")).toBe("archived");
    expect(nextPageStatus("published", "unpublish")).toBe("draft");
    expect(nextPageStatus("published", "archive")).toBe("archived");
    expect(nextPageStatus("archived", "restore")).toBe("published");
  });

  it("lists allowed actions per status", () => {
    expect(allowedPageActions("draft").sort()).toEqual(["archive", "publish"]);
    expect(allowedPageActions("published").sort()).toEqual(["archive", "unpublish"]);
    expect(allowedPageActions("archived")).toEqual(["restore"]);
  });

  it("rejects every action that is not allowed with INVALID_TRANSITION", () => {
    const all = ["publish", "unpublish", "archive", "restore"] as const;
    for (const status of PAGE_STATUSES) {
      for (const action of all) {
        if (action in PAGE_TRANSITIONS[status]) continue;
        expect(() => nextPageStatus(status, action)).toThrow(AppError);
        try {
          nextPageStatus(status, action);
        } catch (e) {
          expect((e as AppError).code).toBe("INVALID_TRANSITION");
        }
      }
    }
  });

  it("shows only published pages to employees", () => {
    expect(isVisibleToEmployees("published")).toBe(true);
    expect(isVisibleToEmployees("draft")).toBe(false);
    expect(isVisibleToEmployees("archived")).toBe(false);
  });
});
