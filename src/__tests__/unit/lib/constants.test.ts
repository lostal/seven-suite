/**
 * Tests de Constantes de la aplicación
 *
 * Verifica valores y funciones helper de src/lib/constants.ts.
 */

import { describe, it, expect } from "vitest";
import {
  APP_NAME,
  APP_DESCRIPTION,
  ROUTES,
  AUTONOMOUS_COMMUNITIES,
  getHomeRouteForRole,
  getSpotTypeLabel,
} from "@/lib/constants";

describe("APP_NAME / APP_DESCRIPTION", () => {
  it("APP_NAME is defined", () => {
    expect(APP_NAME).toBe("Seven Suite");
  });

  it("APP_DESCRIPTION is defined", () => {
    expect(APP_DESCRIPTION).toBe("Sistema de gestión de espacios corporativos");
  });
});

describe("ROUTES", () => {
  it("all route values are strings", () => {
    for (const value of Object.values(ROUTES)) {
      expect(typeof value).toBe("string");
    }
  });

  it("ROUTES is readonly (as const)", () => {
    expect(ROUTES.LOGIN).toBe("/login");
    expect(ROUTES.DASHBOARD).toBe("/panel");
    expect(ROUTES.PARKING).toBe("/parking");
    expect(ROUTES.ADMIN).toBe("/administracion");
  });

  it("has expected keys", () => {
    const keys = Object.keys(ROUTES);
    expect(keys).not.toContain("HOME");
    expect(keys).toContain("LOGIN");
    expect(keys).toContain("LOGIN");
    expect(keys).toContain("DASHBOARD");
    expect(keys).toContain("PARKING");
    expect(keys).toContain("OFFICES");
    expect(keys).toContain("ADMIN");
    expect(keys).toContain("DIRECTORIO");
    expect(keys).toContain("SETTINGS");
    expect(keys).toContain("TABLON");
    expect(keys).toContain("LEAVE");
  });
});

describe("getHomeRouteForRole", () => {
  it("returns dashboard for admin role", () => {
    expect(getHomeRouteForRole("admin")).toBe("/panel");
  });

  it("returns parking for employee role", () => {
    expect(getHomeRouteForRole("employee")).toBe("/parking");
  });

  it("returns parking for other roles (manager, hr)", () => {
    expect(getHomeRouteForRole("manager")).toBe("/parking");
    expect(getHomeRouteForRole("hr")).toBe("/parking");
  });

  it("returns parking for unknown string role", () => {
    expect(getHomeRouteForRole("unknown")).toBe("/parking");
  });

  it("returns parking for undefined role", () => {
    expect(getHomeRouteForRole(undefined)).toBe("/parking");
  });

  it("returns parking for null role", () => {
    expect(getHomeRouteForRole(null)).toBe("/parking");
  });
});

describe("AUTONOMOUS_COMMUNITIES", () => {
  it("has all 19 communities", () => {
    expect(AUTONOMOUS_COMMUNITIES).toHaveLength(19);
  });

  it("every entry has code and name", () => {
    for (const cc of AUTONOMOUS_COMMUNITIES) {
      expect(cc.code).toMatch(/^ES-/);
      expect(typeof cc.name).toBe("string");
      expect(cc.name.length).toBeGreaterThan(0);
    }
  });

  it("includes Madrid and Cataluña", () => {
    const md = AUTONOMOUS_COMMUNITIES.find((c) => c.code === "ES-MD");
    const ct = AUTONOMOUS_COMMUNITIES.find((c) => c.code === "ES-CT");
    expect(md?.name).toBe("Madrid");
    expect(ct?.name).toBe("Cataluña");
  });

  it("all codes are unique", () => {
    const codes = AUTONOMOUS_COMMUNITIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("getSpotTypeLabel", () => {
  it('standard parking → "Fija"', () => {
    expect(getSpotTypeLabel("standard", "parking")).toBe("Fija");
  });

  it('standard office → "Fija"', () => {
    expect(getSpotTypeLabel("standard", "office")).toBe("Fija");
  });

  it('visitor parking → "Visitas"', () => {
    expect(getSpotTypeLabel("visitor", "parking")).toBe("Visitas");
  });

  it('visitor office → "Flexible"', () => {
    expect(getSpotTypeLabel("visitor", "office")).toBe("Flexible");
  });
});
