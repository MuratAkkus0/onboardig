"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { DateTime } from "@/components/common/date-time";
import { StatusBadge } from "@/components/common/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/config/app";
import type { PageAction } from "@/lib/domain/page-status";
import { allowedPageActions } from "@/lib/domain/page-status";
import type { LibraryPage, ModuleWithPages } from "@/server/services/modules";
import {
  changePageStatusAction,
  deleteModuleAction,
  moveModuleAction,
  movePageAction,
  movePageToModuleAction,
} from "@/app/(app)/admin/library/actions";
import { useActionFeedback } from "./action-feedback";
import { DeletePageDialog } from "./delete-page-dialog";
import { ModuleDialog } from "./module-dialog";
import { PageCreateDialog } from "./page-create-dialog";

const STATUS_TOAST: Record<PageAction, "published" | "unpublished" | "archived" | "restored"> = {
  publish: "published",
  unpublish: "unpublished",
  archive: "archived",
  restore: "restored",
};

function PageRow({
  page,
  index,
  total,
  filtered,
  otherModules,
}: {
  page: LibraryPage;
  index: number;
  total: number;
  /** A status filter hides siblings, so the position among the visible rows is meaningless. */
  filtered: boolean;
  otherModules: { id: string; title: string }[];
}) {
  const t = useTranslations("library");
  const run = useActionFeedback();
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const closeDelete = useCallback(() => setDeleting(false), []);

  const move = (direction: "up" | "down") =>
    startTransition(async () => {
      await run(() => movePageAction({ id: page.id, direction }));
    });

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-normal">
        <Link href={ROUTES.adminPageEdit(page.id)} className="hover:underline">
          {page.titleDe}
        </Link>
      </TableCell>
      <TableCell>
        <StatusBadge kind="pageStatus" value={page.status} />
      </TableCell>
      <TableCell>
        <Badge variant={page.hasEnglish ? "secondary" : "outline"}>
          {page.hasEnglish ? t("page.englishAvailable") : t("page.germanOnlyBadge")}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground">
        <DateTime value={page.contentUpdatedAt} />
        {page.lastEditedByName ? <div className="text-xs">{page.lastEditedByName}</div> : null}
      </TableCell>
      <TableCell>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("page.moveUp")}
            title={t("page.moveUp")}
            disabled={pending || filtered || index === 0}
            onClick={() => move("up")}
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("page.moveDown")}
            title={t("page.moveDown")}
            disabled={pending || filtered || index === total - 1}
            onClick={() => move("down")}
          >
            <ArrowDown />
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={ROUTES.adminPageEdit(page.id)}>
              <Pencil />
              {t("page.edit")}
            </Link>
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("page.moreActions", { name: page.titleDe })}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={ROUTES.page(page.id)}>{t("page.preview")}</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {allowedPageActions(page.status).map((action) => (
                <DropdownMenuItem
                  key={action}
                  onSelect={() =>
                    startTransition(async () => {
                      await run(
                        () => changePageStatusAction({ id: page.id, action }),
                        t(`toast.${STATUS_TOAST[action]}`),
                      );
                    })
                  }
                >
                  {t(`actions.${action}`)}
                </DropdownMenuItem>
              ))}
              {otherModules.length > 0 ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>{t("page.moveToModule")}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {otherModules.map((target) => (
                      <DropdownMenuItem
                        key={target.id}
                        onSelect={() =>
                          startTransition(async () => {
                            await run(
                              () => movePageToModuleAction({ id: page.id, moduleId: target.id }),
                              t("toast.pageMoved"),
                            );
                          })
                        }
                      >
                        {target.title}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
                {t("actions.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {deleting ? <DeletePageDialog page={page} onClose={closeDelete} /> : null}
      </TableCell>
    </TableRow>
  );
}

function ModuleCard({
  module,
  index,
  total,
  filtered,
  allModules,
}: {
  module: ModuleWithPages;
  index: number;
  total: number;
  filtered: boolean;
  allModules: ModuleWithPages[];
}) {
  const t = useTranslations("library");
  const run = useActionFeedback();
  const [pending, startTransition] = useTransition();
  const otherModules = allModules
    .filter((other) => other.id !== module.id)
    .map((other) => ({ id: other.id, title: other.titleDe }));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="min-w-0">
          <h2 className="break-words">{module.titleDe}</h2>
          {module.titleEn ? (
            <span className="text-sm font-normal text-muted-foreground">{module.titleEn}</span>
          ) : null}
        </CardTitle>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("module.moveUp")}
            title={t("module.moveUp")}
            disabled={pending || index === 0}
            onClick={() =>
              startTransition(async () => {
                await run(() => moveModuleAction({ id: module.id, direction: "up" }));
              })
            }
          >
            <ArrowUp />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("module.moveDown")}
            title={t("module.moveDown")}
            disabled={pending || index === total - 1}
            onClick={() =>
              startTransition(async () => {
                await run(() => moveModuleAction({ id: module.id, direction: "down" }));
              })
            }
          >
            <ArrowDown />
          </Button>
          <ModuleDialog
            module={module}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("module.rename")}
                title={t("module.rename")}
              >
                <Pencil />
              </Button>
            }
          />
          <ConfirmDialog
            destructive
            title={t("module.deleteTitle")}
            description={t("module.deleteDescription", { name: module.titleDe })}
            confirmLabel={t("actions.delete")}
            trigger={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("module.delete")}
                title={t("module.delete")}
              >
                <Trash2 />
              </Button>
            }
            onConfirm={async () => {
              await run(() => deleteModuleAction({ id: module.id }), t("toast.moduleDeleted"));
            }}
          />
          <PageCreateDialog
            moduleId={module.id}
            trigger={
              <Button variant="outline" size="sm">
                <Plus />
                {t("module.addPage")}
              </Button>
            }
          />
        </div>
      </CardHeader>
      <CardContent>
        {module.pages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {filtered ? t("admin.noPagesFiltered") : t("admin.noPages")}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("admin.pagesColumn")}</TableHead>
                <TableHead>{t("admin.statusColumn")}</TableHead>
                <TableHead>{t("admin.languageColumn")}</TableHead>
                <TableHead>{t("admin.editedColumn")}</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">{t("admin.actionsColumn")}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {module.pages.map((page, pageIndex) => (
                <PageRow
                  key={page.id}
                  page={page}
                  index={pageIndex}
                  total={module.pages.length}
                  filtered={filtered}
                  otherModules={otherModules}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function AdminLibrary({
  modules,
  filtered = false,
}: {
  modules: ModuleWithPages[];
  /** A status filter is active: pages are hidden, so page ordering is disabled. */
  filtered?: boolean;
}) {
  const t = useTranslations("library");
  return (
    <div className="space-y-4">
      {filtered ? (
        <p role="status" className="text-sm text-muted-foreground">
          {t("admin.filterHint")}
        </p>
      ) : null}
      {modules.map((module, index) => (
        <ModuleCard
          key={module.id}
          module={module}
          index={index}
          total={modules.length}
          filtered={filtered}
          allModules={modules}
        />
      ))}
    </div>
  );
}
