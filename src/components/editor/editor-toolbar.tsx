"use client";

import { useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Code2,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FormField } from "@/components/common/form-field";
import { useMessage } from "@/components/common/use-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_CONFIG } from "@/config/app";
import { isAllowedHref } from "@/lib/tiptap/links";

interface ToolButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolButton({ label, active, disabled, onClick, children }: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/** Uploads an image for this page; resolves to the served URL, or null after showing an error. */
async function uploadImage(
  pageId: string,
  file: File,
  message: (key: string) => string,
): Promise<string | null> {
  const body = new FormData();
  body.set("file", file);
  body.set("pageId", pageId);
  try {
    const response = await fetch("/api/uploads", { method: "POST", body });
    const json: unknown = await response.json().catch(() => null);
    if (response.ok) return (json as { url: string }).url;
    const failure = json as { messageKey?: string; details?: { reasonKey?: string } | null } | null;
    toast.error(message(failure?.details?.reasonKey ?? failure?.messageKey ?? "errors.INTERNAL"));
  } catch {
    toast.error(message("errors.INTERNAL"));
  }
  return null;
}

export function EditorToolbar({ editor, pageId }: { editor: Editor | null; pageId: string }) {
  const t = useTranslations("editor");
  const message = useMessage();
  const fileInput = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [linkError, setLinkError] = useState<string>();
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current?.isActive("bold") ?? false,
      italic: current?.isActive("italic") ?? false,
      underline: current?.isActive("underline") ?? false,
      strike: current?.isActive("strike") ?? false,
      code: current?.isActive("code") ?? false,
      link: current?.isActive("link") ?? false,
      heading2: current?.isActive("heading", { level: 2 }) ?? false,
      heading3: current?.isActive("heading", { level: 3 }) ?? false,
      bulletList: current?.isActive("bulletList") ?? false,
      orderedList: current?.isActive("orderedList") ?? false,
      blockquote: current?.isActive("blockquote") ?? false,
      codeBlock: current?.isActive("codeBlock") ?? false,
      canUndo: current?.can().undo() ?? false,
      canRedo: current?.can().redo() ?? false,
    }),
  });
  if (!editor || !state) return null;

  function openLink() {
    setLinkValue((editor?.getAttributes("link").href as string | undefined) ?? "");
    setLinkError(undefined);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!isAllowedHref(linkValue)) {
      setLinkError(t("link.invalid"));
      return;
    }
    editor?.chain().focus().extendMarkRange("link").setLink({ href: linkValue.trim() }).run();
    setLinkOpen(false);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    const toastId = toast.loading(t("image.uploading"));
    const url = await uploadImage(pageId, file, message);
    toast.dismiss(toastId);
    if (url) {
      editor?.chain().focus().setImage({ src: url, alt: "" }).run();
      toast.success(t("image.uploaded"));
    }
  }

  const chain = () => editor.chain().focus();

  return (
    <div className="space-y-2">
      <div
        role="toolbar"
        aria-label={t("toolbar.label")}
        className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/40 p-1"
      >
        <ToolButton
          label={t("toolbar.bold")}
          active={state.bold}
          onClick={() => chain().toggleBold().run()}
        >
          <Bold />
        </ToolButton>
        <ToolButton
          label={t("toolbar.italic")}
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <Italic />
        </ToolButton>
        <ToolButton
          label={t("toolbar.underline")}
          active={state.underline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <Underline />
        </ToolButton>
        <ToolButton
          label={t("toolbar.strike")}
          active={state.strike}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolButton>
        <ToolButton
          label={t("toolbar.code")}
          active={state.code}
          onClick={() => chain().toggleCode().run()}
        >
          <Code />
        </ToolButton>
        <ToolButton
          label={t("toolbar.heading2")}
          active={state.heading2}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToolButton>
        <ToolButton
          label={t("toolbar.heading3")}
          active={state.heading3}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </ToolButton>
        <ToolButton
          label={t("toolbar.bulletList")}
          active={state.bulletList}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List />
        </ToolButton>
        <ToolButton
          label={t("toolbar.orderedList")}
          active={state.orderedList}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolButton>
        <ToolButton
          label={t("toolbar.blockquote")}
          active={state.blockquote}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <Quote />
        </ToolButton>
        <ToolButton
          label={t("toolbar.codeBlock")}
          active={state.codeBlock}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          <Code2 />
        </ToolButton>
        <ToolButton
          label={t("toolbar.horizontalRule")}
          onClick={() => chain().setHorizontalRule().run()}
        >
          <Minus />
        </ToolButton>
        <ToolButton label={t("toolbar.link")} active={state.link} onClick={openLink}>
          <Link2 />
        </ToolButton>
        <ToolButton
          label={t("toolbar.unlink")}
          disabled={!state.link}
          onClick={() => chain().extendMarkRange("link").unsetLink().run()}
        >
          <Link2Off />
        </ToolButton>
        <ToolButton label={t("toolbar.image")} onClick={() => fileInput.current?.click()}>
          <ImagePlus />
        </ToolButton>
        <ToolButton
          label={t("toolbar.undo")}
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <Undo2 />
        </ToolButton>
        <ToolButton
          label={t("toolbar.redo")}
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <Redo2 />
        </ToolButton>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          accept={APP_CONFIG.uploads.allowedMimeTypes.join(",")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            void onFile(file);
          }}
        />
      </div>
      {linkOpen ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border p-2">
          <FormField
            label={t("link.label")}
            description={t("link.hint")}
            error={linkError}
            className="min-w-64 flex-1"
          >
            {(control) => (
              <Input
                {...control}
                value={linkValue}
                inputMode="url"
                onChange={(event) => setLinkValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyLink();
                  }
                }}
              />
            )}
          </FormField>
          <Button type="button" size="sm" onClick={applyLink}>
            {t("link.apply")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setLinkOpen(false)}>
            {t("link.cancel")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
