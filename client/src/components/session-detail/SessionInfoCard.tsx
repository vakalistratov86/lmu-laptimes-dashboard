/**
 * SD-20: Статичная плитка с информацией о трассе и сессии.
 * Заменяет прежние SessionHeader + SessionHeroStats. Не содержит
 * данных о конкретных пилотах (это теперь роль SessionDriverDetailCard) —
 * остаётся неизменной при переключении вкладок Результаты / Круги / Прогресс.
 */
import { Link } from "wouter";
import { ArrowLeft, Trash2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SessionTypeBadge } from "@/components/SessionTypeBadge";
import { StatTile } from "@/components/StatTile";
import { useLanguage } from "@/lib/i18n";

interface SessionInfoCardProps {
  trackName: string;
  courseLabel?: string | null;
  sessionType: string;
  dateFormatted: string;
  backHref: string;
  event?: string | null;
  driverCount?: number | null;
  lapCount?: number | null;
  trackLengthKm?: string | null;
  gameVersion?: string | null;
  /** Хотя бы одна машина сессии вела несколько реальных пилотов по очереди. */
  hasCoDrivers?: boolean;
  /** Кнопка удаления сессии — передаётся только для user.isAdmin (см. SessionDetail.tsx). */
  onDelete?: () => void;
  isDeleting?: boolean;
}

export function SessionInfoCard({
  trackName,
  courseLabel,
  sessionType,
  dateFormatted,
  backHref,
  event,
  driverCount,
  lapCount,
  trackLengthKm,
  gameVersion,
  hasCoDrivers,
  onDelete,
  isDeleting,
}: SessionInfoCardProps) {
  const { t } = useLanguage();
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <Link
            href={backHref}
            data-testid="link-back"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} /> {t("sessionDetail.back")}
          </Link>
          {onDelete && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={isDeleting}
              data-testid="button-delete-session"
            >
              <Trash2 size={14} />
              {t("sessionDetail.deleteSession")}
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <SessionTypeBadge sessionType={sessionType} />
          {hasCoDrivers && (
            <Badge variant="outline" className="gap-1 text-xs" data-testid="badge-team-race">
              <Users size={12} />
              {t("sessionDetail.teamRace")}
            </Badge>
          )}
          <h1 className="font-display text-xl font-bold tracking-tight" data-testid="text-session-title">
            {trackName}
            {courseLabel && <span className="ml-2 text-base font-normal text-muted-foreground">· {courseLabel}</span>}
          </h1>
          <span className="text-sm text-muted-foreground font-mono">{dateFormatted}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {event && <StatTile label={t("sessionDetail.event")} value={event} />}
        {driverCount != null && <StatTile label={t("sessionDetail.drivers")} value={String(driverCount)} />}
        {lapCount != null && <StatTile label={t("sessionDetail.laps")} value={String(lapCount)} />}
        {trackLengthKm && (
          <StatTile label={t("sessionDetail.trackLength")} value={`${trackLengthKm} ${t("tracks.km")}`} />
        )}
        {gameVersion && <StatTile label={t("sessionDetail.gameVersion")} value={gameVersion} />}
      </div>
    </Card>
  );
}
