"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/core";
import { ArrowLeft } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DateTime } from "@/components/common/date-time";
import { FormField } from "@/components/common/form-field";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { SubmitButton } from "@/components/common/submit-button";
import { useMessage } from "@/components/common/use-message";
import { failureKey } from "@/components/content/action-feedback";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES, W1_CONTENT_CONFIG } from "@/config/app";
import {
  clearLocalDraft,
  loadLocalDraft,
  saveLocalDraft,
  type LocalDraft,
} from "@/lib/tiptap/draft";
import {
  savePageAction,
  takeOverLockAction,
} from "@/app/(app)/admin/library/pages/[pageId]/edit/actions";
import { RichTextEditor } from "./rich-text-editor";
import { EMPTY_DOC, type EditablePage } from "./types";
import { asDate, useEditLock } from "./use-edit-lock";

interface Snapshot {
  titleDe: string;
  titleEn: string;
  contentDe: JSONContent;
  contentEn: JSONContent;
}

export function PageEditor({ page }: { page: EditablePage }) {
  const t = useTranslations("editor");
  const message = useMessage();
  const format = useFormatter();
  const router = useRouter();
  const [saving, startSaving] = useTransition();

  const initial: Snapshot = {
    titleDe: page.titleDe,
    titleEn: page.titleEn ?? "",
    contentDe: page.contentDe,
    contentEn: page.contentEn ?? EMPTY_DOC,
  };
  const [seed, setSeed] = useState(initial);
  const [editorKey, setEditorKey] = useState(0);
  const [titleDe, setTitleDe] = useState(initial.titleDe);
  const [titleEn, setTitleEn] = useState(initial.titleEn);
  const [dirty, setDirty] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string>();
  const [saved, setSaved] = useState({ at: page.lastEditedAt, by: page.lastEditedByName });
  const [draftOffer, setDraftOffer] = useState<LocalDraft | null>(null);
  const latest = useRef<Snapshot>(initial);

  const lock = useEditLock({
    pageId: page.id,
    onDraftNeeded: () => {
      if (dirty)
        saveLocalDraft(localStorage, page.id, {
          ...latest.current,
          savedAt: new Date().toISOString(),
        });
    },
    onAcquired: () => setDraftOffer(loadLocalDraft(localStorage, page.id)),
  });
  const editable = lock.phase === "editing";

  function change(patch: Partial<Snapshot>) {
    latest.current = { ...latest.current, ...patch };
    setDirty(true);
  }

  function restoreDraft(draft: LocalDraft) {
    const restored: Snapshot = {
      titleDe: draft.titleDe,
      titleEn: draft.titleEn,
      contentDe: draft.contentDe as JSONContent,
      contentEn: draft.contentEn as JSONContent,
    };
    latest.current = restored;
    setSeed(restored);
    setTitleDe(restored.titleDe);
    setTitleEn(restored.titleEn);
    setEditorKey((key) => key + 1);
    setDirty(true);
    setDraftOffer(null);
  }

  function discardDraft() {
    clearLocalDraft(localStorage, page.id);
    setDraftOffer(null);
  }

  function save(close: boolean) {
    setFieldErrors({});
    setFormError(undefined);
    startSaving(async () => {
      const current = latest.current;
      let result: Awaited<ReturnType<typeof savePageAction>>;
      try {
        result = await savePageAction({
          id: page.id,
          titleDe: current.titleDe,
          titleEn: current.titleEn,
          contentDe: current.contentDe,
          contentEn: current.contentEn,
        });
      } catch {
        // Network failure or rejected request: keep the work locally and stay in the editor.
        saveLocalDraft(localStorage, page.id, { ...current, savedAt: new Date().toISOString() });
        setFormError(message("errors.INTERNAL"));
        return;
      }
      if (result.ok) {
        clearLocalDraft(localStorage, page.id);
        setDirty(false);
        setSaved({ at: result.data.lastEditedAt.toISOString(), by: result.data.lastEditedByName });
        if (close) {
          lock.release();
          router.push(ROUTES.adminLibrary);
        } else {
          toast.success(t("status.saved"));
        }
        return;
      }
      if (result.error.code === "LOCK_LOST") {
        // Never overwrite: keep the work as a local draft and fall back to read-only.
        saveLocalDraft(localStorage, page.id, { ...current, savedAt: new Date().toISOString() });
        const details = result.error.details ?? {};
        const holderName = typeof details.holderName === "string" ? details.holderName : null;
        lock.markLost({ name: holderName, since: asDate(details.since) });
        if (holderName) {
          // The lock banner already says who took over; a generic "expired" error would contradict it.
          setFieldErrors({});
          setFormError(undefined);
          return;
        }
      }
      setFieldErrors(result.error.fieldErrors ?? {});
      setFormError(message(failureKey(result.error)));
    });
  }

  async function takeOver() {
    const result = await takeOverLockAction({ pageId: page.id });
    if (result.ok) window.location.reload();
    else toast.error(message(failureKey(result.error)));
  }

  const fieldError = (name: string) => {
    const key = fieldErrors[name]?.[0];
    return key ? message(key) : undefined;
  };
  const holderName = lock.holder?.name ?? null;
  const since = lock.holder?.since
    ? format.dateTime(lock.holder.since, { timeStyle: "short" })
    : "";

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        description={page.moduleTitle}
        actions={
          <>
            <StatusBadge kind="pageStatus" value={page.status} />
            <Button variant="outline" asChild>
              <Link href={ROUTES.adminLibrary}>
                <ArrowLeft />
                {t("backToLibrary")}
              </Link>
            </Button>
            {editable ? (
              <>
                <SubmitButton variant="outline" pending={saving} onClick={() => save(false)}>
                  {saving ? t("actions.saving") : t("actions.save")}
                </SubmitButton>
                <SubmitButton pending={saving} onClick={() => save(true)}>
                  {t("actions.saveAndClose")}
                </SubmitButton>
              </>
            ) : null}
          </>
        }
      />

      {lock.phase === "acquiring" ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("status.acquiring")}
        </p>
      ) : null}
      {lock.phase === "held" ? (
        <Alert role="status">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {holderName
                ? t("lock.heldBy", { name: holderName, time: since })
                : t("lock.heldByUnknown")}
              {" · "}
              {t("lock.readOnly")}
            </span>
            <ConfirmDialog
              title={t("lock.takeOverTitle")}
              description={t("lock.takeOverDescription", { name: holderName ?? "" })}
              confirmLabel={t("lock.takeOver")}
              trigger={<Button size="sm">{t("lock.takeOver")}</Button>}
              onConfirm={takeOver}
            />
          </AlertDescription>
        </Alert>
      ) : null}
      {lock.phase === "lost" ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {holderName ? t("lock.takenOver", { name: holderName }) : t("lock.expired")}
              {" · "}
              {t("lock.draftKept")}
            </span>
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              {t("lock.reload")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {lock.phase === "idle" ? (
        <Alert role="status">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t("lock.idleReleased")}</span>
            <Button size="sm" onClick={() => window.location.reload()}>
              {t("lock.continue")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {lock.phase === "failed" ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{message("errors.INTERNAL")}</AlertDescription>
        </Alert>
      ) : null}
      {draftOffer && editable ? (
        <Alert role="status">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t("draft.found", {
                date: format.dateTime(new Date(draftOffer.savedAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                }),
              })}
            </span>
            <span className="flex gap-2">
              <Button size="sm" onClick={() => restoreDraft(draftOffer)}>
                {t("draft.restore")}
              </Button>
              <Button size="sm" variant="outline" onClick={discardDraft}>
                {t("draft.discard")}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
      {formError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Tabs defaultValue="de">
        <TabsList>
          <TabsTrigger value="de">{t("tabs.de")}</TabsTrigger>
          <TabsTrigger value="en">{t("tabs.en")}</TabsTrigger>
        </TabsList>
        <TabsContent value="de" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <FormField label={t("fields.titleDe")} error={fieldError("titleDe")}>
            {(control) => (
              <Input
                {...control}
                value={titleDe}
                maxLength={W1_CONTENT_CONFIG.titleMaxLength}
                readOnly={!editable}
                onChange={(event) => {
                  setTitleDe(event.target.value);
                  change({ titleDe: event.target.value });
                }}
              />
            )}
          </FormField>
          <RichTextEditor
            key={`de-${editorKey}`}
            pageId={page.id}
            initialContent={seed.contentDe}
            editable={editable}
            ariaLabel={t("fields.contentDe")}
            onChange={(content) => change({ contentDe: content })}
          />
          {fieldError("contentDe") ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError("contentDe")}
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="en" forceMount className="space-y-4 data-[state=inactive]:hidden">
          <p className="text-sm text-muted-foreground">{t("enHint")}</p>
          <FormField label={t("fields.titleEn")} error={fieldError("titleEn")}>
            {(control) => (
              <Input
                {...control}
                value={titleEn}
                maxLength={W1_CONTENT_CONFIG.titleMaxLength}
                readOnly={!editable}
                onChange={(event) => {
                  setTitleEn(event.target.value);
                  change({ titleEn: event.target.value });
                }}
              />
            )}
          </FormField>
          <RichTextEditor
            key={`en-${editorKey}`}
            pageId={page.id}
            initialContent={seed.contentEn}
            editable={editable}
            ariaLabel={t("fields.contentEn")}
            onChange={(content) => change({ contentEn: content })}
          />
          {fieldError("contentEn") ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError("contentEn")}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>

      <p className="text-sm text-muted-foreground" role="status">
        {dirty ? (
          t("status.dirty")
        ) : (
          <>
            {saved.by ? `${saved.by}, ` : ""}
            <DateTime value={saved.at} />
          </>
        )}
      </p>

      <AlertDialog open={lock.idlePrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("idle.prompt")}</AlertDialogTitle>
            <AlertDialogDescription>{t("idle.description")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button onClick={lock.confirmPresence}>{t("idle.confirm")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
