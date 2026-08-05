import { ExternalLink, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CarClassBadge } from "@/components/CarClassBadge";
import { useLanguage } from "@/lib/i18n";
import { compareCarClass } from "@/lib/classStyles";
import type { SteamAppCard as SteamAppCardData } from "@shared/steamTypes";

interface SteamAppCardProps {
  app: SteamAppCardData;
}

/** Цена/скидка форматируются через Intl.NumberFormat (валюта из ответа Steam) — не хардкодим символ валюты. */
function formatSteamPrice(cents: number, currency: string, intlLocale: string): string {
  return new Intl.NumberFormat(intlLocale, { style: "currency", currency, maximumFractionDigits: 0 }).format(
    cents / 100,
  );
}

function formatReleaseDate(raw: string | null): string {
  return raw && raw.trim().length > 0 ? raw : "—";
}

export function SteamAppCard({ app }: SteamAppCardProps) {
  const { t, intlLocale } = useLanguage();

  const carsByClass = new Map<string, string[]>();
  for (const car of app.cars) {
    const list = carsByClass.get(car.carClass) ?? [];
    list.push(car.name);
    carsByClass.set(car.carClass, list);
  }
  const classesSorted = [...carsByClass.keys()].sort(compareCarClass);

  return (
    <Card className="flex h-full flex-col overflow-hidden" data-testid={`card-steam-app-${app.appid}`}>
      {app.headerImage && (
        <div className="aspect-[460/215] w-full overflow-hidden bg-muted">
          <img src={app.headerImage} alt={app.name} className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-bold leading-tight">{app.name}</h2>
            <Badge variant="outline" className="shrink-0 text-[11px]">
              {app.kind === "game" ? t("steam.badgeGame") : app.isPass ? t("steam.badgePass") : t("steam.badgeDlc")}
            </Badge>
          </div>
          <div className="font-data text-xs tabular-nums text-muted-foreground">
            {t("steam.releaseDate")}: {formatReleaseDate(app.releaseDate)}
          </div>
          {app.isPass && (
            <div className="w-fit rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              {t("steam.passNotice")}
            </div>
          )}
          {app.isUnmappedContent && (
            <div className="w-fit rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
              {t("steam.unmappedNotice")}
            </div>
          )}
        </div>

        <PriceBlock app={app} intlLocale={intlLocale} t={t} />

        {app.shortDescription && <p className="line-clamp-3 text-sm text-muted-foreground">{app.shortDescription}</p>}

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("steam.tracksLabel")}
          </div>
          {app.tracks.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {app.tracks.map((track) => (
                <Badge key={track} variant="outline" className="gap-1 text-xs font-normal">
                  <MapPin size={11} className="text-muted-foreground" />
                  {track}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">{t("steam.tracksUnknown")}</div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("steam.carsLabel")}
          </div>
          {classesSorted.length > 0 ? (
            <div className="space-y-1.5">
              {classesSorted.map((carClass) => (
                <div key={carClass} className="flex flex-wrap items-center gap-1.5">
                  <CarClassBadge carClass={carClass} />
                  <span className="text-xs text-muted-foreground">{carsByClass.get(carClass)!.join(", ")}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">{t("steam.carsUnknown")}</div>
          )}
        </div>

        <a
          href={app.storeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-auto flex items-center gap-1.5 pt-1 text-xs font-medium text-primary hover:underline"
          data-testid={`link-steam-open-${app.appid}`}
        >
          <ExternalLink size={13} />
          {t("steam.openInSteam")}
        </a>
      </div>
    </Card>
  );
}

function PriceBlock({ app, intlLocale, t }: { app: SteamAppCardData; intlLocale: string; t: (key: string) => string }) {
  if (app.price === null) {
    return (
      <div className="text-sm font-semibold">
        {app.isFree ? t("steam.free") : <span className="text-muted-foreground">{t("steam.priceUnavailable")}</span>}
      </div>
    );
  }

  const hasDiscount = app.price.discountPercent > 0;
  return (
    <div className="flex items-center gap-2">
      {hasDiscount && (
        <>
          <Badge className="bg-green-500/15 text-xs font-bold text-green-600 dark:text-green-400" variant="outline">
            -{app.price.discountPercent}%
          </Badge>
          <span className="font-data text-xs tabular-nums text-muted-foreground line-through">
            {formatSteamPrice(app.price.initialCents, app.price.currency, intlLocale)}
          </span>
        </>
      )}
      <span className={`font-data text-sm font-bold tabular-nums ${hasDiscount ? "text-green-500" : ""}`}>
        {formatSteamPrice(app.price.finalCents, app.price.currency, intlLocale)}
      </span>
    </div>
  );
}
