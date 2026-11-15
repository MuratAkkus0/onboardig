"use client";

import { useEffect } from "react";
import type { JSONContent } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { CONTENT_CLASSES } from "@/components/content/content-styles";
import { contentExtensions } from "@/lib/tiptap/extensions";
import { cn } from "@/lib/utils";
import { EditorToolbar } from "./editor-toolbar";

interface RichTextEditorProps {
  pageId: string;
  /** Initial content only; remount with a new `key` to replace it. */
  initialContent: JSONContent;
  editable: boolean;
  ariaLabel: string;
  onChange: (content: JSONContent) => void;
}

/** One Tiptap editor surface with toolbar. Client-only render: `immediatelyRender: false` (SSR). */
export function RichTextEditor({
  pageId,
  initialContent,
  editable,
  ariaLabel,
  onChange,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: contentExtensions,
    content: initialContent,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        role: "textbox",
        "aria-multiline": "true",
        class: cn(
          CONTENT_CLASSES,
          "min-h-72 rounded-md border bg-background px-4 py-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        ),
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  return (
    <div className="space-y-2">
      {editable ? <EditorToolbar editor={editor} pageId={pageId} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
