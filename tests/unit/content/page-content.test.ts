import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PageContent } from "@/components/content/page-content";
import { sanitizeDoc } from "@/lib/tiptap/sanitize";

const ID = "3f2b8f0e-9d1c-4c55-8a5e-0d6f4d2b9c11";

const render = (content: Parameters<typeof PageContent>[0]["content"]) =>
  renderToStaticMarkup(createElement(PageContent, { content }));

describe("PageContent", () => {
  it("renders every node and mark the sanitizer lets through", () => {
    const content = sanitizeDoc({
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Titel" }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "fett", marks: [{ type: "bold" }] },
            {
              type: "text",
              text: " Link",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [{ type: "paragraph", content: [{ type: "text", text: "eins" }] }],
            },
          ],
        },
        { type: "image", attrs: { src: `/api/uploads/${ID}`, alt: "Foto" } },
        { type: "horizontalRule" },
      ],
    });
    const html = render(content);
    expect(html).toContain("<h2>Titel</h2>");
    expect(html).toContain("<strong>fett</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer nofollow"');
    expect(html).toContain("<ol>");
    expect(html).toContain(`src="/api/uploads/${ID}"`);
    expect(html).toContain("<hr/>");
  });

  it("renders nothing for an empty document", () => {
    expect(render({ type: "doc", content: [] })).toBe("");
  });
});
