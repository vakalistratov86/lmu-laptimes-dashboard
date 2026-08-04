import { RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SteamAppCard } from "@/components/SteamAppCard";
import { useLanguage } from "@/lib/i18n";
import { useSteamCatalog, useRefreshSteamCatalog } from "@/lib/api";

export default function SteamCatalog() {
  const { t } = useLanguage();
  const { data, isLoading, isError } = useSteamCatalog();
  const refresh = useRefreshSteamCatalog();

  const items = data?.items ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">{t("steam.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("steam.subtitle")}</p>
        </div>
        <button
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          data-testid="button-steam-refresh"
          className="flex items-center gap-1.5 self-start rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium hover-elevate disabled:opacity-50 sm:self-auto"
        >
          <RefreshCw size={12} className={cn(refresh.isPending && "animate-spin")} />
          {t("steam.refresh")}
        </button>
      </div>

      {data?.source === "static" && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <p>{t("steam.staticSourceNotice")}</p>
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-96" />
          ))}
        </div>
      )}

      {!isLoading && isError && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("steam.loadError")}
        </div>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          {t("steam.empty")}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((app) => (
            <SteamAppCard key={app.appid} app={app} />
          ))}
        </div>
      )}
    </div>
  );
}
