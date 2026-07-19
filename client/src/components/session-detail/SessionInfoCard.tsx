/**
 * SD-20: Статичная плитка с информацией о трассе и сессии.
 * Заменяет прежние SessionHeader + SessionHeroStats. Не содержит
 * данных о конкретных пилотах (это теперь роль SessionDriverDetailCard) —
 * остаётся неизменной при переключении вкладок Результаты / Круги / Прогресс.
 */
import { Link } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSessionTypeBadgeClass } from '@/lib/classStyles';

interface StatTileProps {
  label: string;
  value: string;
}

function StatTile({ label, value }: StatTileProps) {
  return (
    <div className="rounded-lg border border-border bg-card px-3.5 py-2.5 space-y-0.5">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="font-data text-sm font-semibold tabular-nums truncate">{value}</p>
    </div>
  );
}

interface SessionInfoCardProps {
  trackName: string;
  courseLabel?: string | null;
  sessionType: string;
  sessionTypeNorm: string;
  dateFormatted: string;
  backHref: string;
  event?: string | null;
  driverCount?: number | null;
  lapCount?: number | null;
  trackLengthKm?: string | null;
  gameVersion?: string | null;
}

export function SessionInfoCard({
  trackName,
  courseLabel,
  sessionType,
  sessionTypeNorm,
  dateFormatted,
  backHref,
  event,
  driverCount,
  lapCount,
  trackLengthKm,
  gameVersion,
}: SessionInfoCardProps) {
  return (
    <Card className="overflow-hidden">
      <div className="space-y-3 border-b border-border px-4 py-3">
        <Link
          href={backHref}
          data-testid="link-back"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} /> Все сессии
        </Link>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <Badge
            variant="outline"
            className={`text-xs ${getSessionTypeBadgeClass(sessionTypeNorm)}`}
          >
            {sessionType}
          </Badge>
          <h1
            className="font-display text-xl font-bold tracking-tight"
            data-testid="text-session-title"
          >
            {trackName}
            {courseLabel && (
              <span className="ml-2 text-base font-normal text-muted-foreground">
                · {courseLabel}
              </span>
            )}
          </h1>
          <span className="text-sm text-muted-foreground font-mono">{dateFormatted}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 lg:grid-cols-5">
        {event && <StatTile label="Событие" value={event} />}
        {driverCount != null && <StatTile label="Пилотов" value={String(driverCount)} />}
        {lapCount != null && <StatTile label="Кругов" value={String(lapCount)} />}
        {trackLengthKm && <StatTile label="Длина трассы" value={`${trackLengthKm} км`} />}
        {gameVersion && <StatTile label="Версия игры" value={gameVersion} />}
      </div>
    </Card>
  );
}
