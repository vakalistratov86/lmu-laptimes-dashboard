import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Trophy,
  Flag,
  ListChecks,
  Upload,
  Moon,
  Sun,
  Menu,
  X,
  CalendarDays,
  Activity,
  User,
} from "lucide-react";
import { Logo } from "./Logo";
import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLanguage, type Locale } from "@/lib/i18n";
import { useImportActivity } from "@/lib/importActivity";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// Импорт логов перенесён из бокового меню в иконку хедера (см. ImportButton) —
// в основном списке навигации страниц больше не участвует.
function useNav() {
  const { t } = useLanguage();
  return [
    { href: "/", label: t("nav.overview"), icon: LayoutDashboard, testId: "link-overview" },
    { href: "/leaderboards", label: t("nav.leaderboards"), icon: Trophy, testId: "link-leaderboards" },
    { href: "/profile", label: t("nav.pilotProfile"), icon: User, testId: "link-pilot-profile" },
    { href: "/tracks", label: t("nav.tracks"), icon: Flag, testId: "link-tracks" },
    { href: "/sessions", label: t("nav.sessions"), icon: ListChecks, testId: "link-sessions" },
    { href: "/telemetry", label: t("nav.telemetry"), icon: Activity, testId: "link-telemetry" },
    { href: "/events", label: t("nav.events"), icon: CalendarDays, testId: "link-events" },
  ];
}

function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);
  return { theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) };
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const [location] = useLocation();
  const { t } = useLanguage();
  const NAV = useNav();
  const isActive = (href: string) => (href === "/" ? location === "/" : location.startsWith(href));

  return (
    <>
      <div className="flex items-center gap-2 border-b border-sidebar-border px-5 py-4">
        <Logo size={26} />
        <div className="leading-tight">
          <div className="font-display text-base font-bold tracking-tight text-sidebar-foreground">
            LMU<span className="text-primary"> Dashboard</span>
          </div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground">{t("nav.tagline")}</div>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={item.testId}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover-elevate",
                active ? "bg-primary/10 text-primary" : "text-sidebar-foreground/80 hover:text-sidebar-foreground",
              )}
            >
              <Icon style={{ width: 18, height: 18 }} className="shrink-0" />
              <span>{item.label}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function LanguageSwitcher() {
  const { locale, setLocale, t } = useLanguage();
  const options: Locale[] = ["ru", "en"];
  return (
    <div
      className="flex h-9 items-center rounded-md border border-border p-0.5 text-xs font-semibold"
      role="group"
      aria-label={t("header.toggleLanguage")}
    >
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          data-testid={`button-locale-${opt}`}
          onClick={() => setLocale(opt)}
          aria-pressed={locale === opt}
          className={cn(
            "h-8 min-w-[34px] rounded-[5px] uppercase transition-colors",
            locale === opt ? "bg-primary/10 text-primary" : "text-muted-foreground hover-elevate",
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

/**
 * Иконка перехода на /import в хедере (раньше — пункт бокового меню).
 * Пульсирующая точка показывает, что скан/импорт идёт в фоне, даже если
 * пользователь ушёл со страницы — mode приходит из общего ImportActivityContext,
 * в который пишут и Import.tsx (вкладка логов), и TelemetryImportPanel.tsx.
 */
function ImportButton() {
  const { t } = useLanguage();
  const { mode } = useImportActivity();
  const [location] = useLocation();
  const active = location.startsWith("/import");
  const isBusy = mode !== "idle";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/import"
          data-testid="button-header-import"
          aria-label={t("nav.import")}
          className={cn(
            "relative flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover-elevate",
            active ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground",
          )}
        >
          <Upload size={16} />
          {isBusy && <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-primary" />}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">{t("nav.import")}</TooltipContent>
    </Tooltip>
  );
}

export function AppLayout({ children }: { children: ReactNode }) {
  const { theme, toggle } = useTheme();
  const { t } = useLanguage();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  return (
    <div className="grid h-[100dvh] grid-cols-1 grid-rows-[auto_1fr] overflow-hidden bg-background md:grid-cols-[15rem_1fr]">
      {/* Desktop sidebar */}
      <aside className="row-span-2 hidden w-60 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar [overscroll-behavior:contain] md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            data-testid="overlay-mobile-menu"
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar [overscroll-behavior:contain]">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur md:col-start-2 md:px-6">
        <div className="flex items-center gap-3">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate md:hidden"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={t("header.menu")}
            data-testid="button-mobile-menu"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="hidden sm:inline">{t("header.monitoringActive")}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ImportButton />
          <LanguageSwitcher />
          <button
            data-testid="button-theme-toggle"
            onClick={toggle}
            aria-label={t("header.toggleTheme")}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover-elevate"
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="overflow-y-auto [overscroll-behavior:contain] md:col-start-2">
        <div className="mx-auto max-w-[1200px] px-4 py-6 md:px-6">{children}</div>
      </main>
    </div>
  );
}
