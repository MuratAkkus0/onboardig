import { isAllowedHref } from "@/lib/tiptap/links";
import { W1_CONTENT_CONFIG } from "@/config/app";
import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";

/**
 * The one extension list that defines which nodes and marks exist. The editor adds its
 * client-only extensions (placeholder, character count) on top; the page renderer uses this list
 * as it is, so everything the editor can store also renders.
 */
export const contentExtensions = [
  StarterKit.configure({
    heading: { levels: [...W1_CONTENT_CONFIG.headingLevels] },
    link: {
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      isAllowedUri: (url) => isAllowedHref(url),
      HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
    },
    trailingNode: false,
  }),
  Image.configure({ inline: false, allowBase64: false }),
];
