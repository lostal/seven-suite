import { describe, expect, it, vi, afterEach } from "vitest";

import { decryptToken, encryptToken } from "@/lib/auth/token-crypto";

describe("Microsoft token crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("encrypts and decrypts tokens without returning the plaintext", () => {
    vi.stubEnv("AUTH_SECRET", "a-secure-test-secret-that-is-long-enough");

    const encrypted = encryptToken("access-token");

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain("access-token");
    expect(decryptToken(encrypted)).toBe("access-token");
  });

  it("keeps legacy plaintext readable during re-authentication rollout", () => {
    expect(decryptToken("legacy-token")).toBe("legacy-token");
  });

  it("rejects tampered ciphertext", () => {
    vi.stubEnv("AUTH_SECRET", "a-secure-test-secret-that-is-long-enough");
    const encrypted = encryptToken("refresh-token");
    const parts = encrypted.split(":");
    const tampered = [
      parts[0],
      parts[1],
      parts[2],
      `x${parts[3]?.slice(1)}`,
      parts[4],
    ].join(":");

    expect(() => decryptToken(tampered)).toThrow("Unable to decrypt token");
  });
});
