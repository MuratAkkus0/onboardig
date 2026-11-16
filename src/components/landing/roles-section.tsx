import {
  Bell,
  Bold,
  CalendarDays,
  Check,
  Heading2,
  ImageIcon,
  Italic,
  Languages,
  Link2,
  List,
  Lock,
  MessageSquareWarning,
  Search,
  Settings2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { APP_CONFIG, LANDING_CONFIG } from "@/config/app";
import { initialsOf } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { demoDate } from "./demo";
import { MockWindow } from "./mock-window";
import { SectionHeading } from "./section-heading";
import { StepRow } from "./step-row";

const CARD =
  "group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 text-card-foreground shadow-raised landing-reveal transition-[transform,box-shadow] duration-200 hover:shadow-float md:p-8 [@media(hover:hover)_and_(pointer:fine)]:motion-safe:hover:-translate-y-0.5";

const MORE = [
  { key: "events", icon: CalendarDays },
  { key: "notifications", icon: Bell },
  { key: "search", icon: Search },
  { key: "bilingual", icon: Languages },
  { key: "lock", icon: Lock },
  { key: "report", icon: MessageSquareWarning },
] as const;

const TOOLBAR: readonly LucideIcon[] = [Bold, Italic, Heading2, List, Link2, ImageIcon];

function CardHead({ icon: Icon, role, title }: { icon: LucideIcon; role: string; title: string }) {
  return (
    <>
      <Badge variant="outline" className="gap-1.5 px-2.5 py-1">
        <Icon aria-hidden />
        {role}
      </Badge>
      <h3 className="mt-4 text-xl font-semibold tracking-tight text-balance break-words">
        {title}
      </h3>
    </>
  );
}

function Points({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 space-y-2.5 text-sm/6">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5">
          <Check aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
          <span className="text-pretty">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function EmployeeCard() {
  const t = useTranslations();
  const security = LANDING_CONFIG.demo.planSteps.find((step) => step.key === "security");
  return (
    <article className={cn(CARD, "lg:col-span-6")}>
      <CardHead
        icon={UserRound}
        role={t("enums.role.employee")}
        title={t("landing.roles.employee.title")}
      />
      <Points
        items={[
          t("landing.roles.employee.points.plan"),
          t("landing.roles.employee.points.updated"),
          t("landing.roles.employee.points.more"),
        ]}
      />
      <div aria-hidden inert className="mt-8 flex flex-1 flex-col justify-end">
        <div className="rounded-xl border bg-background p-4 text-[0.8125rem]">
          <div className="flex h-9 items-center gap-2 rounded-md border px-3 text-sm">
            <Search className="size-4 text-muted-foreground" />
            {t("landing.mock.searchQuery")}
          </div>
          {security && "doneOn" in security ? (
            <ul className="mt-3 rounded-lg border">
              <StepRow
                title={t.rich("landing.mock.searchResult", {
                  hl: (chunks) => (
                    <span className="rounded-sm bg-brand-soft px-0.5 text-brand-soft-foreground">
                      {chunks}
                    </span>
                  ),
                })}
                state="done"
                doneOn={demoDate(security.doneOn)}
                updated
              />
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function TeamLeadCard() {
  const t = useTranslations();
  const format = useFormatter();
  const { team, teamPreview } = LANDING_CONFIG.demo;
  const people = team.filter((person) => (teamPreview as readonly string[]).includes(person.key));
  return (
    <article className={cn(CARD, "lg:col-span-6")}>
      <CardHead
        icon={Users}
        role={t("enums.role.team_lead")}
        title={t("landing.roles.teamLead.title")}
      />
      <Points
        items={[
          t("landing.roles.teamLead.points.assign"),
          t("landing.roles.teamLead.points.progress"),
          t("landing.roles.teamLead.points.content"),
        ]}
      />
      <div aria-hidden inert className="mt-8 flex flex-1 flex-col justify-end">
        <div className="space-y-3 rounded-xl border bg-background p-4">
          {people.map((person) => {
            const name = t(`landing.mock.people.${person.key}`);
            const [first = "", ...rest] = name.split(" ");
            return (
              <div key={person.key} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-medium">
                  {initialsOf(first, rest.at(-1) ?? "")}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
                <span className="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-ring-track">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${person.percent}%` }}
                  />
                </span>
                <span className="w-10 shrink-0 text-right font-landing-mono text-xs tabular-nums">
                  {format.number(person.percent / 100, { style: "percent" })}
                </span>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <span className={buttonVariants({ variant: "outline", size: "xs" })}>
              {t("plan.assign.action")}
            </span>
            <Badge variant="secondary">{t("plan.assign.suggested")}</Badge>
          </div>
        </div>
      </div>
    </article>
  );
}

function AdminCard() {
  const t = useTranslations();
  const format = useFormatter();
  const { lock } = LANDING_CONFIG.demo;
  return (
    <article className={cn(CARD, "lg:col-span-12")}>
      <div className="grid gap-8 md:grid-cols-2 md:items-center">
        <div>
          <CardHead
            icon={Settings2}
            role={t("enums.role.admin")}
            title={t("landing.roles.admin.title")}
          />
          <Points
            items={[
              t("landing.roles.admin.points.users"),
              t("landing.roles.admin.points.org"),
              t("landing.roles.admin.points.library"),
              t("landing.roles.admin.points.reports"),
            ]}
          />
        </div>
        <div aria-hidden inert>
          <MockWindow
            path={t("landing.mock.windowPathEditor", { appSlug: APP_CONFIG.appName.toLowerCase() })}
            className="shadow-raised"
          >
            <p className="flex items-center gap-2 rounded-md bg-brand-soft px-3 py-2 text-xs text-brand-soft-foreground">
              <Lock className="size-3.5 shrink-0" />
              <span className="text-pretty">
                {t("editor.lock.heldBy", {
                  name: t(`landing.mock.people.${lock.person}`),
                  time: format.dateTime(new Date(lock.since), {
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </span>
            </p>
            <div className="mt-3 flex gap-1 border-b pb-2">
              {TOOLBAR.map((Icon, position) => (
                <span
                  key={position}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground"
                >
                  <Icon className="size-4" />
                </span>
              ))}
            </div>
            <p className="mt-3 text-base font-semibold">{t("landing.mock.editorPage")}</p>
            <span className="mt-2 block h-2 w-full rounded bg-muted" />
            <span className="mt-2 block h-2 w-11/12 rounded bg-muted" />
            <span className="mt-2 block h-2 w-4/6 rounded bg-muted" />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline">
                {t("plan.assign.scopeDepartment", { name: t("landing.mock.department") })}
              </Badge>
              <Badge variant="outline">
                {t("plan.assign.scopeTeam", { name: t("landing.mock.team") })}
              </Badge>
              <Badge variant="outline">
                {t("plan.assign.scopeJobRole", { name: t("landing.mock.jobRole") })}
              </Badge>
            </div>
          </MockWindow>
        </div>
      </div>
    </article>
  );
}

/** Role cards (bento) with small illustrative mockups, then the "also included" grid. */
export function RolesSection({ index }: { index: number }) {
  const t = useTranslations("landing");
  return (
    <section
      id={LANDING_CONFIG.sectionIds.roles}
      aria-labelledby={LANDING_CONFIG.headingIds.roles}
      className="scroll-mt-20 py-20 md:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          id={LANDING_CONFIG.headingIds.roles}
          index={index}
          eyebrow={t("roles.eyebrow")}
          title={t("roles.title")}
          lead={t("roles.lead")}
          align="center"
        />

        <div className="mt-14 grid gap-4 md:gap-6 lg:grid-cols-12">
          <EmployeeCard />
          <TeamLeadCard />
          <AdminCard />
        </div>

        <div className="mt-16">
          <h3 className="text-lg/7 font-semibold tracking-[-0.01em]">{t("roles.more.title")}</h3>
          {/* Revealed as a whole (see FactsStrip): per-cell reveals expose the bg-border dividers. */}
          <ul className="mt-6 grid landing-reveal gap-px overflow-clip rounded-2xl border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {MORE.map(({ key, icon: Icon }) => (
              <li
                key={key}
                className="bg-background p-6 transition-colors duration-150 hover:bg-surface-sunken"
              >
                <Icon aria-hidden strokeWidth={1.75} className="size-5 text-brand" />
                <p className="mt-4 font-medium break-words">{t(`roles.more.${key}.title`)}</p>
                <p className="mt-1 text-sm/6 text-pretty text-muted-foreground">
                  {t(`roles.more.${key}.body`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
