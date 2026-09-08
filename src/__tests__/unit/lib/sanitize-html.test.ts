import { describe, expect, it } from "vitest";

import { sanitizeAnnouncementHtml } from "@/lib/content/sanitize-html";

describe("sanitizeAnnouncementHtml", () => {
  it("removes scripts and unsafe URLs", () => {
    const result = sanitizeAnnouncementHtml(
      '<p>Hola</p><script>alert(1)</script><a href="javascript:alert(1)">x</a>'
    );

    expect(result).toContain("<p>Hola</p>");
    expect(result).not.toContain("script");
    expect(result).not.toContain("javascript:");
  });

  it("keeps safe links with a safe target policy", () => {
    const result = sanitizeAnnouncementHtml(
      '<a href="https://gruposiete.es">Web</a>'
    );

    expect(result).toContain('href="https://gruposiete.es"');
    expect(result).toContain('rel="noopener noreferrer"');
    expect(result).toContain('target="_blank"');
  });
});
