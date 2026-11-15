import type { JSONContent } from "@tiptap/core";
import { renderToReactElement } from "@tiptap/static-renderer/pm/react";
import { isEmptyDoc } from "@/lib/domain/locale-content";
import { contentExtensions } from "@/lib/tiptap/extensions";
import { cn } from "@/lib/utils";
import type { TiptapDoc } from "@/server/db/schema/custom-types";
import { CONTENT_CLASSES } from "./content-styles";

/** Renders stored Tiptap JSON with the same extension list the editor uses. */
export function PageContent({ content, className }: { content: TiptapDoc; className?: string }) {
  if (isEmptyDoc(content)) return null;
  return (
    <div className={cn(CONTENT_CLASSES, className)}>
      {renderToReactElement({ extensions: contentExtensions, content: content as JSONContent })}
    </div>
  );
}
