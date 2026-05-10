/**
 * Tests de Sign Out Action
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignOut = vi.hoisted(() => vi.fn());
const mockClearActiveEntityCookie = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/config", () => ({
  signOut: mockSignOut,
}));

vi.mock("@/components/layout/entity-switcher-actions", () => ({
  clearActiveEntityCookie: mockClearActiveEntityCookie,
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((_url: string) => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { redirect } from "next/navigation";
import { signOutAction } from "@/lib/auth/sign-out";

describe("signOutAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls signOut with redirect:false then redirects to login", async () => {
    mockSignOut.mockResolvedValueOnce(undefined);
    mockClearActiveEntityCookie.mockResolvedValueOnce(undefined);

    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT");

    expect(mockClearActiveEntityCookie).toHaveBeenCalled();
    expect(mockSignOut).toHaveBeenCalledWith({ redirect: false });
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("calls clearActiveEntityCookie before signOut", async () => {
    const order: string[] = [];
    mockClearActiveEntityCookie.mockImplementationOnce(async () => {
      order.push("clearCookie");
    });
    mockSignOut.mockImplementationOnce(async () => {
      order.push("signOut");
    });
    try {
      await signOutAction();
    } catch {
      order.push("redirect");
    }

    expect(order).toEqual(["clearCookie", "signOut", "redirect"]);
  });
});
