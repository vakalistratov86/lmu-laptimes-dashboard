import { History } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CHANGELOG_URL = "https://github.com/vakalistratov86/lmu-laptimes-dashboard/blob/main/CHANGELOG.md";

const SECTION_LABEL_KEYS: Record<string, string> = {
  Added: "version.sectionAdded",
  Fixed: "version.sectionFixed",
  Changed: "version.sectionChanged",
  Removed: "version.sectionRemoved",
  Docs: "version.sectionDocs",
  Refactored: "version.sectionRefactored",
};

function formatChangelogDate(iso: string, intlLocale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale, { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * Версия приложения в подвале бокового меню (десктоп и мобильный drawer —
 * оба переиспользуют SidebarContent). Номер — из package.json (define в
 * vite.config.ts), клик открывает попап с последней записью CHANGELOG.md,
 * если сборка смогла её распарсить.
 */
export function AppVersion() {
  const { t, intlLocale } = useLanguage();
  const entry = __LATEST_CHANGELOG__;

  const versionLabel = (
    <span className="flex items-center gap-1.5 font-data text-[11px] tabular-nums text-muted-foreground">
      <History size={11} className="shrink-0" />v{__APP_VERSION__}
    </span>
  );

  if (!entry) {
    return (
      <div
        className="border-t border-sidebar-border px-5 py-2.5"
        aria-label={t("version.label", { version: __APP_VERSION__ })}
      >
        {versionLabel}
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="button-app-version"
          aria-label={t("version.label", { version: __APP_VERSION__ })}
          className="group flex w-full items-center justify-between border-t border-sidebar-border px-5 py-2.5 text-left transition-colors hover-elevate"
        >
          {versionLabel}
          <span className="text-[10px] text-muted-foreground/70 group-hover:text-foreground">
            {t("version.whatsNew")}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="p-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-data text-sm font-bold tabular-nums">v{entry.version}</span>
          <span className="font-data text-[10px] tabular-nums text-muted-foreground">
            {formatChangelogDate(entry.date, intlLocale)}
          </span>
        </div>
        <div className="mt-2 flex flex-col gap-2">
          {entry.sections.map((section) => (
            <div key={section.title}>
              <div className="text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {SECTION_LABEL_KEYS[section.title] ? t(SECTION_LABEL_KEYS[section.title]) : section.title}
              </div>
              <ul className="mt-1 list-disc pl-3.5 text-xs leading-snug">
                {section.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <a
          href={CHANGELOG_URL}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block border-t border-border pt-2 text-xs font-semibold text-primary hover:underline"
        >
          {t("version.fullChangelog")} →
        </a>
      </PopoverContent>
    </Popover>
  );
}
