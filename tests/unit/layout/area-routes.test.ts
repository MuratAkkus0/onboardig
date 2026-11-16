import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/app";
import { areaOf, areaRoutes } from "@/lib/area-routes";

describe("areaRoutes", () => {
  it("maps admins to the admin area and everybody else to the lead area", () => {
    expect(areaOf("admin")).toBe("admin");
    expect(areaOf("team_lead")).toBe("lead");
  });

  it("returns the route tree of each area", () => {
    expect(areaRoutes("admin").library).toBe(ROUTES.adminLibrary);
    expect(areaRoutes("admin").template("1")).toBe(ROUTES.adminTemplate("1"));
    expect(areaRoutes("lead").library).toBe(ROUTES.library);
    expect(areaRoutes("lead").pageEdit("p")).toBe("/library/pages/p/edit");
    expect(areaRoutes("lead").templateNew).toBe("/templates/new");
  });
});
